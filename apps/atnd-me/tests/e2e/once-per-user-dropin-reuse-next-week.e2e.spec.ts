/**
 * E2E regression: drop-in with “Once per user” checkbox must not be reusable next week.
 *
 * Recreates the production-preview bug (no promo codes):
 * 1. Customer pays for a once-per-user drop-in on this week’s class (mocked card / webhook).
 * 2. Customer opens the same event type next week.
 * 3. Drop-in must not be offered again, and create-payment-intent must reject reuse.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { postHoldFulfillmentWebhook } from './helpers/stripe-webhook-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  ensureTenantDropInPlatformFeePercent,
  getPayloadInstance,
} from './helpers/data-helpers'

async function completeMockCardDropInBooking(args: {
  page: import('@playwright/test').Page
  request: import('@playwright/test').APIRequestContext
  payload: Awaited<ReturnType<typeof getPayloadInstance>>
  tenantSlug: string
  tenantId: number
  userId: number
  timeslotId: number
  dropInId: number
  connectAccountId: string
}) {
  const {
    page,
    request,
    payload,
    tenantSlug,
    tenantId,
    userId,
    timeslotId,
    dropInId,
    connectAccountId,
  } = args

  // Confirm Drop-in is offered on the booking page (UI under test for week 2).
  // First /bookings/[id] compile in next dev can exceed the default navigationTimeout.
  await page.goto(`http://${tenantSlug}.localhost:3000/bookings/${timeslotId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await expect(page).toHaveURL(new RegExp(`/bookings/${timeslotId}$`), { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible({ timeout: 30_000 })

  // Mock card payment without waiting on UI-driven PI (avoids hang if Elements/hold race).
  const hold = (await payload.create({
    collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
    data: {
      tenant: tenantId,
      timeslot: timeslotId,
      user: userId,
      quantity: 1,
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
    overrideAccess: true,
  })) as { id: number }

  // Node DNS may not resolve `*.localhost`; use loopback + Host header (see auth-helpers).
  const piRes = await page.request.post(
    'http://localhost:3000/api/stripe/connect/create-payment-intent',
    {
      data: {
        price: 10,
        metadata: {
          timeslotId: String(timeslotId),
          quantity: '1',
          holdId: String(hold.id),
        },
      },
      headers: {
        'Content-Type': 'application/json',
        Host: `${tenantSlug}.localhost:3000`,
      },
      timeout: 60_000,
    },
  )
  const piText = await piRes.text()
  expect(piRes.ok(), `create-payment-intent failed: ${piRes.status()} ${piText}`).toBeTruthy()
  const piJson = JSON.parse(piText) as { clientSecret?: string }
  expect(piJson.clientSecret).toMatch(/^pi_test_.*_secret_test$/)

  const paymentIntentId = piJson.clientSecret!.replace(/_secret_test$/, '')
  const webhook = await postHoldFulfillmentWebhook(request, {
    connectAccountId,
    userId,
    tenantId,
    holdId: hold.id,
    timeslotId,
    quantity: 1,
    dropInId,
    paymentIntentId,
  })
  expect(webhook.status, `hold fulfill webhook failed: ${JSON.stringify(webhook.body)}`).toBe(
    200,
  )

  await expect
    .poll(async () => {
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { timeslot: { equals: timeslotId } },
            { user: { equals: userId } },
            { status: { equals: 'confirmed' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return bookings.totalDocs
    }, { timeout: 15_000 })
    .toBe(1)
}

test.describe('Once-per-user drop-in reuse next week', () => {
  test.describe.configure({ timeout: 180_000 })

  test('cannot reuse a once-per-user drop-in on the same class next week', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = Number(testData.users.user1.id)
    const workerIndex = testData.workerIndex

    if (!tenantId || !tenantSlug || !Number.isFinite(userId)) {
      throw new Error('Tenant or user fixture is missing for once-per-user drop-in reuse test')
    }

    await ensureTenantDropInPlatformFeePercent(tenantId, 2)

    const connectAccountId = `acct_once_reuse_${tenantId}_w${workerIndex}`
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: connectAccountId,
      },
      overrideAccess: true,
    })

    // Isolate from other bookings on this shared fixture user/tenant.
    await payload.delete({
      collection: 'bookings',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { user: { equals: userId } },
        ],
      },
      overrideAccess: true,
    })

    // Under test: drop-in admin checkbox “Once per user” (not a promo / coupon).
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Once Per User Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        oncePerUser: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    // Drop-in only — no membership/class-pass fallback.
    const classOption = await createTestEventType(
      tenantId,
      'Once Per User Drop-in Class',
      5,
      undefined,
      workerIndex,
    )
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: {
          allowedDropIn: dropIn.id,
          allowedPlans: [],
          allowedClassPasses: [],
        },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const mkTimeslot = async (daysFromNow: number) => {
      const start = new Date()
      start.setDate(start.getDate() + daysFromNow)
      start.setHours(12, 0, 0, 0)
      const end = new Date(start)
      end.setHours(13, 0, 0, 0)
      return createTestTimeslot(tenantId, classOption.id, start, end, undefined, true)
    }

    const thisWeek = await mkTimeslot(1)
    const nextWeek = await mkTimeslot(8)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    // ── Week 1: pay with once-per-user drop-in (mocked card / webhook) ───────
    await completeMockCardDropInBooking({
      page,
      request,
      payload,
      tenantSlug,
      tenantId,
      userId,
      timeslotId: thisWeek.id,
      dropInId: dropIn.id,
      connectAccountId,
    })

    const firstBookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: thisWeek.id } },
          { user: { equals: userId } },
          { status: { equals: 'confirmed' } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    expect(firstBookings.totalDocs).toBe(1)

    const firstBookingIds = firstBookings.docs.map((b) => b.id)
    const stampedTxns = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { booking: { in: firstBookingIds } },
          { paymentMethod: { equals: 'stripe' } },
          { dropInId: { equals: dropIn.id } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(
      stampedTxns.totalDocs,
      'webhook fulfill must stamp dropInId for once-per-user tracking',
    ).toBeGreaterThanOrEqual(1)

    // ── Week 2: same class — drop-in must not be usable again ────────────────
    await page.goto(`http://${tenantSlug}.localhost:3000/bookings/${nextWeek.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await expect(page).toHaveURL(new RegExp(`/bookings/${nextWeek.id}$`), { timeout: 30_000 })

    // When once-per-user works on a drop-in-only class, Payment Methods tabs are gone and
    // only the already-used warning is shown (no "Payment Methods" heading).
    // If the bug is present, Drop-in remains and this already-used assertion fails.
    await expect(page.getByText(/already used this drop-in/i)).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toHaveCount(0)

    // API guard: with a valid hold, create-payment-intent must still reject reuse.
    const hold = (await payload.create({
      collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
      data: {
        tenant: tenantId,
        timeslot: nextWeek.id,
        user: userId,
        quantity: 1,
        status: 'active',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      overrideAccess: true,
    })) as { id: number }

    const reuseIntent = await page.request.post(
      'http://localhost:3000/api/stripe/connect/create-payment-intent',
      {
        data: {
          price: 10,
          metadata: {
            timeslotId: String(nextWeek.id),
            quantity: '1',
            holdId: String(hold.id),
          },
        },
        headers: {
          'Content-Type': 'application/json',
          Host: `${tenantSlug}.localhost:3000`,
        },
        timeout: 60_000,
      },
    )
    const reuseBodyText = await reuseIntent.text()
    expect(
      reuseIntent.status(),
      `expected 400 rejecting once-per-user reuse, got ${reuseIntent.status()}: ${reuseBodyText}`,
    ).toBe(400)
    const reuseBody = JSON.parse(reuseBodyText) as { error?: string }
    expect(reuseBody.error ?? '').toMatch(/already used this drop-in/i)

    const secondBookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: nextWeek.id } },
          { user: { equals: userId } },
          { status: { equals: 'confirmed' } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    expect(
      secondBookings.totalDocs,
      'once-per-user drop-in must not create a confirmed booking next week',
    ).toBe(0)
  })
})

/**
 * E2E: Once-per-user drop-in is offered once, then hidden on the next booking.
 *
 * Flow:
 * 1. Create a drop-in with oncePerUser + a membership plan on the same event type.
 * 2. User completes a drop-in purchase on timeslot A (100% promo / €0 fulfill).
 * 3. User opens timeslot B: Drop-in tab is gone; Membership remains available.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  ensureTenantDropInPlatformFeePercent,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Once-per-user drop-in', () => {
  test.describe.configure({ timeout: 120_000 })

  test('after purchasing a once-per-user drop-in, the next booking does not offer drop-in', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = testData.users.user1.id
    const workerIndex = testData.workerIndex

    if (!tenantId || !tenantSlug || !userId) {
      throw new Error('Tenant or user fixture is missing for once-per-user drop-in test')
    }

    await ensureTenantDropInPlatformFeePercent(tenantId, 2)

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_once_dropin_${tenantId}`,
      },
      overrideAccess: true,
    })

    const promoCode = `ONCE${tenantId}${workerIndex}`.slice(0, 24).toUpperCase()
    await payload.create({
      collection: 'discount-codes',
      data: {
        name: `Once-per-user free promo ${tenantId}-${workerIndex}`,
        code: promoCode,
        type: 'percentage_off',
        value: 100,
        duration: 'once',
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Once Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        oncePerUser: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    const plan = (await payload.create({
      collection: 'plans',
      data: {
        tenant: tenantId,
        name: `E2E Once Drop-in Plan ${tenantId}-${workerIndex}-${Date.now()}`,
        status: 'active',
        skipSync: true,
        sessionsInformation: {
          sessions: 10,
          interval: 'week',
          intervalCount: 1,
          maxBookingsPerTimeslot: 1,
        },
        stripeProductId: `prod_once_dropin_plan_${tenantId}_${workerIndex}_${Date.now()}`,
        priceJSON: JSON.stringify({
          id: `price_once_dropin_plan_${tenantId}_${workerIndex}_${Date.now()}`,
        }),
      },
      overrideAccess: true,
    })) as { id: number }

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
          allowedPlans: [plan.id],
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

    const lesson1 = await mkTimeslot(1)
    const lesson2 = await mkTimeslot(2)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    // ── First booking: drop-in is available and can be purchased ─────────────
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson1.id}`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson1.id}$`), { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: /drop-?in/i }).click()

    const zeroAmountIntent = page.waitForResponse(
      (res) => {
        if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
        const req = res.request()
        if (req.method() !== 'POST') return false
        const postData = req.postData()
        if (!postData) return false
        try {
          const body = JSON.parse(postData) as { price?: number; confirmOnly?: boolean }
          return body.price === 0 && body.confirmOnly !== true
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )

    await page.getByLabel('Promo code').fill(promoCode)
    await page.getByRole('button', { name: /^Apply$/i }).click()
    await Promise.all([
      expect(page.getByText(/promo code applied/i)).toBeVisible({ timeout: 15_000 }),
      zeroAmountIntent,
    ])

    const bootstrapRes = await zeroAmountIntent
    expect(
      bootstrapRes.ok(),
      `create-payment-intent (€0 bootstrap) failed: ${bootstrapRes.status()} ${await bootstrapRes.text()}`,
    ).toBeTruthy()

    await expect(page.getByTestId('complete-free-booking')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('complete-free-booking').click()

    await page.waitForURL(/\/success\?/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /thank you!/i })).toBeVisible({
      timeout: 15_000,
    })

    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: lesson1.id } },
          { user: { equals: Number(userId) } },
          { status: { equals: 'confirmed' } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    expect(bookings.totalDocs).toBe(1)

    const bookingIds = bookings.docs.map((b) => b.id)
    const txns = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { booking: { in: bookingIds } },
          { paymentMethod: { equals: 'stripe' } },
          { dropInId: { equals: dropIn.id } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(
      txns.totalDocs,
      'fulfill should stamp dropInId on the stripe transaction for once-per-user tracking',
    ).toBeGreaterThanOrEqual(1)

    // ── Second booking: drop-in must not be offered; membership still is ─────
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson2.id}`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson2.id}$`), { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
      timeout: 30_000,
    })

    await expect(page.getByRole('tab', { name: /membership/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toHaveCount(0)
  })
})

/**
 * Regression: Event page checkout holds must release when the user leaves
 * before entering card details (guest Continue, or auth drop-in bootstrap).
 *
 * These assert the production failure mode: hold is reserved, payment UI may
 * show test/mock state (no card form), user navigates away → hold must be gone.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestPage,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

async function countActiveHoldsForTimeslotUser(
  payload: Awaited<ReturnType<typeof getPayloadInstance>>,
  timeslotId: number,
  userId: number,
) {
  const result = await payload.find({
    collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
    where: {
      and: [
        { timeslot: { equals: timeslotId } },
        { user: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
    depth: 0,
    limit: 20,
    overrideAccess: true,
  })
  return result.totalDocs ?? 0
}

async function countActiveHoldsForTimeslot(
  payload: Awaited<ReturnType<typeof getPayloadInstance>>,
  timeslotId: number,
) {
  const result = await payload.find({
    collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
    where: {
      and: [{ timeslot: { equals: timeslotId } }, { status: { equals: 'active' } }],
    },
    depth: 0,
    limit: 20,
    overrideAccess: true,
  })
  return result.totalDocs ?? 0
}

async function seedEventPageWithDropIn(opts: {
  tenantId: number
  tenantSlug: string
  workerIndex: number
  label: string
  places?: number
}) {
  const payload = await getPayloadInstance()
  const { tenantId, workerIndex, label } = opts
  const places = opts.places ?? 5

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_event_hold_${label}_${tenantId}_w${workerIndex}`,
    },
    overrideAccess: true,
  })

  const dropIn = (await payload.create({
    collection: 'drop-ins',
    data: {
      name: `E2E Event Hold ${label} ${tenantId}-w${workerIndex}-${Date.now()}`,
      isActive: true,
      price: 15,
      adjustable: true,
      tenant: tenantId,
    },
    overrideAccess: true,
  })) as { id: number }

  const eventType = await createTestEventType(
    tenantId,
    `Event Hold ${label}`,
    places,
    undefined,
    workerIndex,
  )

  await payload.update({
    collection: 'event-types',
    id: eventType.id,
    data: {
      paymentMethods: { allowedDropIn: dropIn.id },
      tenant: tenantId,
    },
    overrideAccess: true,
  })

  const startTime = new Date()
  startTime.setHours(18, 0, 0, 0)
  startTime.setDate(startTime.getDate() + 2 + workerIndex)
  const endTime = new Date(startTime)
  endTime.setHours(19, 0, 0, 0)

  const lesson = await createTestTimeslot(
    tenantId,
    eventType.id,
    startTime,
    endTime,
    undefined,
    true,
  )

  const pageSlug = `e2e-event-hold-${label}-w${workerIndex}-${Date.now()}`
  await createTestPage(tenantId, pageSlug, `E2E Event Hold ${label}`, {
    layout: [
      {
        blockType: 'event',
        eventType: eventType.id,
        timeslot: lesson.id,
      },
    ],
  })

  return {
    payload,
    lessonId: lesson.id as number,
    pageSlug,
    dropInId: dropIn.id,
  }
}

test.describe('Event page: checkout hold release on leave (before card)', () => {
  test.describe.configure({ timeout: 120_000 })

  test('guest: leave after Continue (hold reserved, no card entry) releases hold', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      tenantSlug: tenant.slug,
      workerIndex,
      label: 'guest-continue',
    })

    const guestEmail = `event-hold-guest-${workerIndex}-${Date.now()}@example.com`
    const guestName = 'Event Hold Guest'

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
    await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

    await page.locator('#guest-name').fill(guestName)
    await page.locator('#guest-email').fill(guestEmail)

    const reservePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/events/guest-reserve-hold') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )

    await page.getByTestId('guest-checkout-continue').click()
    await reservePromise

    // Hold exists; payment UI may still be bootstrapping — never interact with a card form.
    await expect
      .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1)

    // Soft leave before any Pay / card input (and while CheckoutForm may still upsert).
    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect
      .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 25_000 })
      .toBe(0)
  })

  test('guest: leave after payment UI ready (still no card) releases hold', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      tenantSlug: tenant.slug,
      workerIndex,
      label: 'guest-ready',
    })

    const guestEmail = `event-hold-guest-ready-${workerIndex}-${Date.now()}@example.com`

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
    await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

    await page.locator('#guest-name').fill('Ready Guest')
    await page.locator('#guest-email').fill(guestEmail)

    const guestCheckoutPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/events/guest-checkout') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: 30_000 },
    )

    await page.getByTestId('guest-checkout-continue').click()
    await guestCheckoutPromise

    // Test mode: mock PI → no Stripe card element. Hold must still release on leave.
    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({ timeout: 15_000 })

    const guestUser = await payload.find({
      collection: 'users',
      where: { email: { equals: guestEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    expect(guestUser.docs).toHaveLength(1)
    const guestUserId = guestUser.docs[0]!.id as number

    await expect
      .poll(
        () => countActiveHoldsForTimeslotUser(payload, lessonId, guestUserId),
        { timeout: 20_000 },
      )
      .toBeGreaterThanOrEqual(1)

    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect
      .poll(
        () => countActiveHoldsForTimeslotUser(payload, lessonId, guestUserId),
        { timeout: 25_000 },
      )
      .toBe(0)
  })

  test('guest: late upsert after tab close must not leave capacity held', async ({
    browser,
    testData,
    request,
  }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      tenantSlug: tenant.slug,
      workerIndex,
      label: 'guest-late-upsert',
    })

    const guestEmail = `event-hold-late-${workerIndex}-${Date.now()}@example.com`
    const guestName = 'Late Upsert Guest'
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
      await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

      await page.locator('#guest-name').fill(guestName)
      await page.locator('#guest-email').fill(guestEmail)

      const reservePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/events/guest-reserve-hold') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 30_000 },
      )

      await page.getByTestId('guest-checkout-continue').click()
      await reservePromise

      await expect
        .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 20_000 })
        .toBeGreaterThanOrEqual(1)

      const activeHold = await payload.find({
        collection: 'booking-checkout-holds' as import('payload').CollectionSlug,
        where: {
          and: [
            { timeslot: { equals: lessonId } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const checkoutSessionId = (activeHold.docs[0] as { checkoutSessionId?: string | null } | undefined)
        ?.checkoutSessionId
      expect(checkoutSessionId).toBeTruthy()

      await page.close()

      // Unload release should clear the hold first.
      await expect
        .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 25_000 })
        .toBe(0)

      // Simulate a late in-flight upsert for the same checkout session after the tab is gone.
      const lateUpsert = await request.post('http://127.0.0.1:3000/api/events/guest-reserve-hold', {
        headers: { Host: `${tenant.slug}.localhost:3000` },
        data: {
          timeslotId: lessonId,
          quantity: 1,
          guestName,
          guestEmail,
          checkoutSessionId,
        },
        failOnStatusCode: false,
      })
      expect(lateUpsert.status()).toBe(200)
      const lateJson = (await lateUpsert.json()) as { abandoned?: boolean; holdId?: number | null }
      expect(lateJson.abandoned).toBe(true)

      await expect
        .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 10_000 })
        .toBe(0)
    } finally {
      await context.close().catch(() => null)
    }
  })

  test('guest: closing the tab after Continue (no card entry) releases hold', async ({
    browser,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const workerIndex = testData.workerIndex
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      tenantSlug: tenant.slug,
      workerIndex,
      label: 'guest-tabclose',
    })

    const guestEmail = `event-hold-tabclose-${workerIndex}-${Date.now()}@example.com`
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
      await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

      await page.locator('#guest-name').fill('Tab Close Guest')
      await page.locator('#guest-email').fill(guestEmail)

      const reservePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/events/guest-reserve-hold') &&
          res.request().method() === 'POST' &&
          res.status() === 200,
        { timeout: 30_000 },
      )

      await page.getByTestId('guest-checkout-continue').click()
      await reservePromise

      await expect
        .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 20_000 })
        .toBeGreaterThanOrEqual(1)

      // Hard exit (tab close) — relies on pagehide/beforeunload + beacon/XHR, not React cleanup.
      await page.close()

      await expect
        .poll(() => countActiveHoldsForTimeslot(payload, lessonId), { timeout: 25_000 })
        .toBe(0)
    } finally {
      await context.close().catch(() => null)
    }
  })

  test('authenticated: leave after drop-in hold reserved (no card entry) releases hold', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex
    const { payload, lessonId, pageSlug } = await seedEventPageWithDropIn({
      tenantId: tenant.id as number,
      tenantSlug: tenant.slug,
      workerIndex,
      label: 'auth',
    })

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    await navigateToTenant(page, tenant.slug, `/${pageSlug}`)
    await expect(page.getByTestId('event-ticket-panel')).toBeVisible({ timeout: 20_000 })

    // Auth checkout bootstraps a hold when PaymentMethods / CheckoutForm mounts.
    // In test mode there is no card form — leave before any Pay click.
    await expect
      .poll(
        () => countActiveHoldsForTimeslotUser(payload, lessonId, user.id as number),
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(1)

    // Test mode: mock PI — same signal as guest cases. Do not `.or()` with
    // "Payment Methods" text; that heading can be visible at the same time and
    // trips Playwright strict mode.
    await expect(page.getByTestId('stripe-not-configured')).toBeVisible({
      timeout: 20_000,
    })

    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)

    await expect
      .poll(
        () => countActiveHoldsForTimeslotUser(payload, lessonId, user.id as number),
        { timeout: 25_000 },
      )
      .toBe(0)
  })
})

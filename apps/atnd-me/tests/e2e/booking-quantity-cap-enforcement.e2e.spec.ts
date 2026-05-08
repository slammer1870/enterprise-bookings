/**
 * Booking quantity cap enforcement
 *
 * Ensures the UI prevents users from selecting or booking more slots than
 * permitted by:
 *   a) the numeric `maxBookingsPerTimeslot` configured on the payment method type
 *      the event uses, and
 *   b) the timeslot's remaining capacity.
 *
 * These tests complement the single-slot (cap=1) and unlimited (cap=∞) tests
 * in manage-booking-upgrade-guards.e2e.spec.ts by specifically covering
 * numeric caps (e.g., 2) and capacity-driven caps.
 *
 * Covered scenarios:
 *  1. Booking page: + button disabled at numeric class-pass maxBookingsPerTimeslot
 *  2. Booking page: + button disabled at timeslot remaining capacity (< method max)
 *  3. Manage page (quantity view): + disabled at numeric per-method cap
 *  4. Manage page (checkout view): + disabled once pending count reaches remaining capacity
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestBooking,
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Navigate to the booking page (initial booking flow) and wait for the quantity selector. */
async function openBookingPage(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  userEmail: string
  lessonId: number
}) {
  const { page, tenantSlug, userEmail, lessonId } = args

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}`)

    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)

    const outcome = await Promise.race([
      page
        .getByText(/select quantity/i)
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'success' as const),
      page
        .getByRole('heading', { name: /booking page error/i })
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'success') return
    if (attempt < 2) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(`Failed to load booking page for lesson ${lessonId}. URL: ${page.url()}`)
}

/** Navigate to the manage page and wait for the expected view state. */
async function openManagePage(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  userEmail: string
  lessonId: number
  expectedState: 'quantity' | 'checkout'
}) {
  const { page, tenantSlug, userEmail, lessonId, expectedState } = args

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}/manage`)

    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)

    const outcome = await Promise.race([
      page
        .getByText(/update booking quantity/i)
        .first()
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'quantity' as const),
      page
        .getByRole('heading', { name: /complete payment/i })
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'checkout' as const),
      page
        .getByRole('heading', { name: /booking page error/i })
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === expectedState) return
    if (attempt < 2) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(
    `Failed to reach manage page "${expectedState}" state for lesson ${lessonId}. URL: ${page.url()}`
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Booking quantity cap enforcement', () => {
  test.describe.configure({ timeout: 120_000 })

  /**
   * Booking page: the top-level quantity selector is capped at the numeric
   * maxBookingsPerTimeslot set on the class-pass type associated with the event.
   *
   * Specifically: class-pass with maxBookingsPerTimeslot=2 and timeslot capacity=10
   * → the + button is enabled from 1→2 but disabled once quantity reaches 2.
   */
  test('booking page: + button disabled at numeric class-pass maxBookingsPerTimeslot', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    // Class-pass type with a numeric cap of exactly 2 slots per timeslot.
    const classPassType = (await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Cap Enforcement Class Pass ${tenant.id}-w${workerIndex}-${Date.now()}`,
        slug: `cap-enforcement-cp-${tenant.id}-${workerIndex}-${Date.now()}`,
        quantity: 10,
        tenant: tenant.id,
        maxBookingsPerTimeslot: 2,
        priceInformation: { price: 19.99 },
        skipSync: true,
        stripeProductId: `prod_cap_cp_${tenant.id}_${workerIndex}_${Date.now()}`,
      },
      overrideAccess: true,
    })) as { id: number }

    // Give the user a class pass so the class-pass tab is relevant.
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await payload.create({
      collection: 'class-passes',
      data: {
        user: user.id,
        tenant: tenant.id,
        type: classPassType.id,
        quantity: 10,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 1999,
        status: 'active',
      },
      overrideAccess: true,
    })

    // Event type with ample capacity; method cap (2) should be the binding constraint.
    const eventType = await createTestEventType(
      tenant.id,
      'Cap Enforcement Class Pass Booking',
      10,
      undefined,
      workerIndex
    )

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedClassPasses: [classPassType.id] } },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(8, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 3 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(9, 0, 0, 0)

    const timeslot = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      endTime,
      undefined,
      true
    )

    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug: tenant.slug })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    await openBookingPage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
    })

    // The top-level QuantitySelector renders with aria-label buttons.
    // With only a class-pass method configured (no drop-in), there is exactly one
    // pair of increase/decrease quantity buttons on the page.
    const increaseBtn = page.getByRole('button', { name: /increase quantity/i }).first()
    const decreaseBtn = page.getByRole('button', { name: /decrease quantity/i }).first()

    // The selector starts at 1 and can grow up to the cap (2).
    await expect(increaseBtn).toBeVisible({ timeout: 10000 })
    await expect(increaseBtn).toBeEnabled({ timeout: 10000 })

    // Increase: 1 → 2 (should succeed — at the cap but not over it).
    await increaseBtn.click()
    // At quantity=2 the + button must become disabled.
    await expect(increaseBtn).toBeDisabled({ timeout: 10000 })

    // The − button is still enabled (we're not at the minimum).
    await expect(decreaseBtn).toBeEnabled()

    // Decrease: 2 → 1 (re-enables the + button).
    await decreaseBtn.click()
    await expect(increaseBtn).toBeEnabled({ timeout: 5000 })
  })

  /**
   * Booking page: when the timeslot's remaining capacity is lower than the
   * payment method's per-user cap, capacity wins.
   *
   * Specifically: adjustable drop-in (unlimited), timeslot capacity=2
   * → the + button is disabled once the selector reaches 2.
   */
  test('booking page: + button disabled at timeslot remaining capacity when capacity is the binding limit', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user2
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    // Unlimited drop-in — the cap should come purely from capacity.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Cap Enforcement Capacity Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 15,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    // Event type with capacity=2 so that remainingCapacity=2 becomes the cap.
    const eventType = await createTestEventType(
      tenant.id,
      'Cap Enforcement Capacity Booking',
      2,
      undefined,
      workerIndex
    )

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedDropIn: dropIn.id } },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(9, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 3 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(10, 0, 0, 0)

    const timeslot = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      endTime,
      undefined,
      true
    )

    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug: tenant.slug })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    await openBookingPage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
    })

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 10000 })

    // The top-level QuantitySelector is the first one rendered on the page.
    // It reflects `remainingCapacity` (2) as the max — the drop-in's unlimited cap
    // does not relax the capacity constraint.
    const increaseBtn = page.getByRole('button', { name: /increase quantity/i }).first()
    const decreaseBtn = page.getByRole('button', { name: /decrease quantity/i }).first()

    await expect(increaseBtn).toBeVisible({ timeout: 10000 })
    await expect(increaseBtn).toBeEnabled()

    // Increase to 2 (= capacity). Button should become disabled.
    await increaseBtn.click()
    await expect(increaseBtn).toBeDisabled({ timeout: 10000 })
    await expect(decreaseBtn).toBeEnabled()

    // Verify we can step back down, which re-enables increase.
    await decreaseBtn.click()
    await expect(increaseBtn).toBeEnabled({ timeout: 5000 })
  })

  /**
   * Manage page (quantity view): the increase button is disabled once the
   * desired total quantity reaches the numeric payment-method cap.
   *
   * Specifically: class-pass with maxBookingsPerTimeslot=2, user has 1 confirmed booking
   * → manage page shows booking-quantity=1, can increase to 2, increase button is
   *   then disabled.  Clicking "Update Bookings" at quantity=2 (with payment required)
   *   transitions to the checkout view.
   */
  test('manage page: increase button disabled once desired quantity reaches numeric payment-method cap', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user3 ?? testData.users.user1
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    // Class-pass type capped at exactly 2 per timeslot.
    const classPassType = (await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Manage Cap Enforcement CP ${tenant.id}-w${workerIndex}-${Date.now()}`,
        slug: `manage-cap-cp-${tenant.id}-${workerIndex}-${Date.now()}`,
        quantity: 10,
        tenant: tenant.id,
        maxBookingsPerTimeslot: 2,
        priceInformation: { price: 24.99 },
        skipSync: true,
        stripeProductId: `prod_manage_cap_${tenant.id}_${workerIndex}_${Date.now()}`,
      },
      overrideAccess: true,
    })) as { id: number }

    // Give the user a class pass.
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await payload.create({
      collection: 'class-passes',
      data: {
        user: user.id,
        tenant: tenant.id,
        type: classPassType.id,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 2499,
        status: 'active',
      },
      overrideAccess: true,
    })

    // Event type with ample capacity so the method cap (2) is the binding constraint.
    const eventType = await createTestEventType(
      tenant.id,
      'Manage Cap Enforcement Class Pass',
      10,
      undefined,
      workerIndex
    )

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedClassPasses: [classPassType.id] } },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 3 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const timeslot = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      endTime,
      undefined,
      true
    )

    // Pre-create 1 confirmed booking.
    await createTestBooking(user.id, timeslot.id, 'confirmed')

    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug: tenant.slug })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    const bookingQty = page.getByTestId('booking-quantity')
    const increaseBtn = page.getByRole('button', { name: /increase quantity/i })
    const updateBtn = page.getByRole('button', { name: /update bookings/i })

    // Starts at 1 confirmed booking.
    await expect(bookingQty).toHaveText('1', { timeout: 10000 })

    // Increase is enabled at 1 (cap=2, so one more is allowed).
    await expect(increaseBtn).toBeEnabled({ timeout: 10000 })
    await increaseBtn.click()
    await expect(bookingQty).toHaveText('2', { timeout: 5000 })

    // Now at the cap — increase must be disabled.
    await expect(increaseBtn).toBeDisabled({ timeout: 5000 })

    // The Update Bookings button should be enabled (desired=2 ≠ current=1).
    await expect(updateBtn).toBeEnabled({ timeout: 5000 })

    // Clicking Update transitions to checkout because the class-pass requires payment.
    // (CardTitle renders as a generic element; assert via text rather than heading role.)
    await updateBtn.click()
    await expect(
      page.getByText(/new bookings to pay for/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  /**
   * Manage page (checkout view): the + button is disabled once the pending count
   * reaches the timeslot's remaining capacity (as captured at checkout entry).
   *
   * Specifically: adjustable drop-in, timeslot capacity=2, user has 1 confirmed booking
   * (remaining capacity = 1).  After entering checkout the pending count is 1 and
   * checkoutMaxRef = 1, so the + button must be immediately disabled.
   */
  test('manage page (checkout): + button disabled when pending bookings reach remaining capacity', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    // Adjustable drop-in: no per-user method cap, so only capacity constrains checkout.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Checkout Capacity Cap Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 18,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    // Event type with capacity=2.  User will hold 1 confirmed → remaining=1.
    const eventType = await createTestEventType(
      tenant.id,
      'Checkout Capacity Cap',
      2,
      undefined,
      workerIndex
    )

    await payload.update({
      collection: 'event-types',
      id: eventType.id,
      data: { paymentMethods: { allowedDropIn: dropIn.id } },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setHours(11, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 3 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(12, 0, 0, 0)

    const timeslot = await createTestTimeslot(
      tenant.id,
      eventType.id,
      startTime,
      endTime,
      undefined,
      true
    )

    // 1 confirmed booking → remainingCapacity = 1 on the SSR-loaded timeslot.
    await createTestBooking(user.id, timeslot.id, 'confirmed')

    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug: tenant.slug })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    const bookingQty = page.getByTestId('booking-quantity')
    await expect(bookingQty).toHaveText('1', { timeout: 10000 })

    // Increase to 2 and update — should enter checkout with 1 pending booking.
    const increaseBtn = page.getByRole('button', { name: /increase quantity/i })
    await expect(increaseBtn).toBeEnabled({ timeout: 10000 })
    await increaseBtn.click()
    await expect(bookingQty).toHaveText('2', { timeout: 5000 })

    // At quantity=2 the increase button must be disabled
    // (max = active(1) + remaining(1) = 2 = desired).
    await expect(increaseBtn).toBeDisabled({ timeout: 5000 })

    await page.getByRole('button', { name: /update bookings/i }).click()

    // Wait for the checkout view.
    // (CardTitle renders as a generic element; assert via text rather than heading role.)
    await expect(
      page.getByText(/new bookings to pay for/i).first()
    ).toBeVisible({ timeout: 15000 })

    const pendingQty = page.getByTestId('pending-booking-quantity')
    await expect(pendingQty).toHaveText('1', { timeout: 10000 })

    // The + button in the checkout view must be disabled because:
    // pendingQty (1) >= checkoutMaxRef (1 = remaining capacity at checkout entry).
    const increaseNewBtn = page.getByRole('button', { name: /increase new bookings/i })
    await expect(increaseNewBtn).toBeVisible({ timeout: 10000 })
    await expect(increaseNewBtn).toBeDisabled({ timeout: 5000 })

    // The − button is still enabled (can reduce pending back to 0 / abandon checkout).
    const decreaseNewBtn = page.getByRole('button', { name: /decrease new bookings/i })
    await expect(decreaseNewBtn).toBeEnabled()
  })
})

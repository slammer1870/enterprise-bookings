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

  /**
   * Regression: drop-in `maxBookingsPerTimeslot` must be cleared correctly.
   *
   * Bug report summary:
   * - If a drop-in is created with `maxBookingsPerTimeslot=1`, the manage UI correctly caps increases.
   * - If the admin later clears/removes the field (so it becomes `null` or `undefined`)
   *   the app must treat it as "unlimited per user" and re-relax the cap.
   *
   * This test verifies both update styles:
   * - update to explicit `null` (expected to work)
   * - simulate "field removed" by updating with `undefined` (should also work)
   */
  test('manage page: drop-in maxBookingsPerTimeslot cleared to null/undefined relaxes cap', async ({
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
        // Keep it stable; manage pages can touch payment config.
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    // Drop-in starts capped at 1 per timeslot.
    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Cap Clear Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
        isActive: true,
        price: 15,
        tenant: tenant.id,
        // Important: numeric cap present initially.
        maxBookingsPerTimeslot: 1,
      },
      overrideAccess: true,
    })) as { id: number }

    // Timeslot capacity = 3, so after 1 confirmed booking we should have remainingCapacity=2.
    const eventType = await createTestEventType(
      tenant.id,
      'Cap Clear Drop-in Booking',
      3,
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
    startTime.setHours(10, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 3 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const timeslot = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)
    await createTestBooking(user.id, timeslot.id, 'confirmed')

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    // Manage pages can render multiple payment-method tabs. Ensure we’re looking
    // at the Drop-in tab controls for this assertion.
    const dropInTab = page.getByRole('tab', { name: /drop-?in/i }).first()
    if ((await dropInTab.count()) > 0) {
      await dropInTab.click()
    }

    const bookingQty = page.getByTestId('booking-quantity')
    const increaseBtns = page.getByRole('button', { name: /increase quantity/i })

    // With maxBookingsPerTimeslot=1 and current booking qty=1, the increase button must be disabled.
    await expect(bookingQty).toHaveText('1', { timeout: 10_000 })
    // Some UIs hide the button entirely when capped at 1.
    await expect(increaseBtns).toHaveCount(0, { timeout: 10_000 })

    // 1) Update to explicit null → should be treated as "unlimited per user".
    await payload.update({
      collection: 'drop-ins',
      id: dropIn.id,
      data: { maxBookingsPerTimeslot: null },
      overrideAccess: true,
    })

    const dropInAfterNull = await payload.findByID({
      collection: 'drop-ins',
      id: dropIn.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(dropInAfterNull?.maxBookingsPerTimeslot).toBeNull()

    const eventTypeAfterNull = (await payload.findByID({
      collection: 'event-types',
      id: eventType.id,
      depth: 5,
      overrideAccess: true,
    })) as any
    const allowedDropInAfterNull = eventTypeAfterNull?.paymentMethods?.allowedDropIn
    expect(allowedDropInAfterNull).not.toBeNull()
    if (typeof allowedDropInAfterNull === 'object') {
      expect(allowedDropInAfterNull.maxBookingsPerTimeslot).toBeNull()
    }

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    const dropInTabAfterNull = page.getByRole('tab', { name: /drop-?in/i }).first()
    if ((await dropInTabAfterNull.count()) > 0) {
      await dropInTabAfterNull.click()
    }

    const bookingQtyAfterNull = page.getByTestId('booking-quantity')
    const increaseBtnsAfterNull = page.getByRole('button', { name: /increase quantity/i })
    const increaseBtnAfterNull = increaseBtnsAfterNull.first()

    await expect(bookingQtyAfterNull).toHaveText('1', { timeout: 10_000 })
    await expect(increaseBtnsAfterNull).toHaveCount(1, { timeout: 10_000 })
    await expect(increaseBtnAfterNull).toBeEnabled({ timeout: 10_000 })

    // With capacity=3 and current confirmed=1, max desired total should be 3.
    await increaseBtnAfterNull.click()
    await expect(bookingQtyAfterNull).toHaveText('2', { timeout: 5_000 })
    await increaseBtnAfterNull.click()
    await expect(bookingQtyAfterNull).toHaveText('3', { timeout: 5_000 })
    await expect(increaseBtnAfterNull).toBeDisabled({ timeout: 5_000 })

    // 2) Re-set cap to 1, then clear it again with null. This simulates the real user
    // flow a second time to verify the fix is not a one-shot fluke (e.g. the cap can
    // be restored and re-cleared indefinitely).
    await payload.update({
      collection: 'drop-ins',
      id: dropIn.id,
      data: { maxBookingsPerTimeslot: 1 },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'drop-ins',
      id: dropIn.id,
      data: { maxBookingsPerTimeslot: null },
      overrideAccess: true,
    })

    const dropInAfterUndefined = await payload.findByID({
      collection: 'drop-ins',
      id: dropIn.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(dropInAfterUndefined?.maxBookingsPerTimeslot).toBeNull()

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    const dropInTabAfterUndefined = page.getByRole('tab', { name: /drop-?in/i }).first()
    if ((await dropInTabAfterUndefined.count()) > 0) {
      await dropInTabAfterUndefined.click()
    }

    const bookingQtyAfterUndefined = page.getByTestId('booking-quantity')
    const increaseBtnsAfterUndefined = page.getByRole('button', { name: /increase quantity/i })
    const increaseBtnAfterUndefined = increaseBtnsAfterUndefined.first()

    await expect(bookingQtyAfterUndefined).toHaveText('1', { timeout: 10_000 })
    await expect(increaseBtnsAfterUndefined).toHaveCount(1, { timeout: 10_000 })
    await expect(increaseBtnAfterUndefined).toBeEnabled({ timeout: 10_000 })

    await increaseBtnAfterUndefined.click()
    await expect(bookingQtyAfterUndefined).toHaveText('2', { timeout: 5_000 })
    await increaseBtnAfterUndefined.click()
    await expect(bookingQtyAfterUndefined).toHaveText('3', { timeout: 5_000 })
    await expect(increaseBtnAfterUndefined).toBeDisabled({ timeout: 5_000 })
  })

  /**
   * Regression: class-pass-type `maxBookingsPerTimeslot` cleared to null relaxes cap.
   *
   * The class-pass collection schema treats `maxBookingsPerTimeslot: null` as
   * "no per-user limit". If a class pass previously had a numeric cap (e.g. 1) and
   * the field is then cleared to null, the manage page must unlock the + button so the
   * user can book up to the timeslot's remaining capacity.
   *
   * The bug: Payload serialisation strips null keys from nested relation docs, so
   * `maxBookingsPerTimeslot: null` arrives at the client as `undefined`. The client
   * then falls back to the legacy `allowMultipleBookingsPerTimeslot` field (false),
   * and the cap stays at 1.
   *
   * Fix: `populateTimeslotEventType` explicitly re-fetches each class-pass-type doc
   * to preserve the null, and `computeViewerMax` now treats `null` as unlimited.
   */
  test('manage page: class-pass maxBookingsPerTimeslot cleared to null relaxes cap', async ({
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

    // Class-pass type starts capped at 1 per timeslot.
    const classPassType = (await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Cap Clear CP ${tenant.id}-w${workerIndex}-${Date.now()}`,
        slug: `cap-clear-cp-${tenant.id}-${workerIndex}-${Date.now()}`,
        quantity: 10,
        tenant: tenant.id,
        maxBookingsPerTimeslot: 1,
        allowMultipleBookingsPerTimeslot: false,
        priceInformation: { price: 20 },
        skipSync: true,
        stripeProductId: `prod_cap_clear_cp_${tenant.id}_${workerIndex}_${Date.now()}`,
      },
      overrideAccess: true,
    })) as { id: number }

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
        status: 'active',
      },
      overrideAccess: true,
    })

    // Timeslot capacity = 3, so with 1 confirmed booking remainingCapacity = 2.
    const eventType = await createTestEventType(
      tenant.id,
      'Cap Clear Class Pass Event',
      3,
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

    const timeslot = await createTestTimeslot(tenant.id, eventType.id, startTime, endTime, undefined, true)
    await createTestBooking(user.id, timeslot.id, 'confirmed')

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    const classPassTab = page.getByRole('tab', { name: /class.?pass/i }).first()
    if ((await classPassTab.count()) > 0) await classPassTab.click()

    const bookingQty = page.getByTestId('booking-quantity')
    const increaseBtns = page.getByRole('button', { name: /increase quantity/i })

    // With maxBookingsPerTimeslot=1 and current qty=1, the + button must be hidden.
    await expect(bookingQty).toHaveText('1', { timeout: 10_000 })
    await expect(increaseBtns).toHaveCount(0, { timeout: 10_000 })

    // Clear the cap: explicit null → "no per-user limit".
    await payload.update({
      collection: 'class-pass-types',
      id: classPassType.id,
      data: { maxBookingsPerTimeslot: null },
      overrideAccess: true,
    })

    const cpAfterNull = await payload.findByID({
      collection: 'class-pass-types',
      id: classPassType.id,
      depth: 0,
      overrideAccess: true,
    })
    expect((cpAfterNull as any)?.maxBookingsPerTimeslot).toBeNull()

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'quantity',
    })

    const classPassTabAfter = page.getByRole('tab', { name: /class.?pass/i }).first()
    if ((await classPassTabAfter.count()) > 0) await classPassTabAfter.click()

    const bookingQtyAfter = page.getByTestId('booking-quantity')
    const increaseBtnsAfter = page.getByRole('button', { name: /increase quantity/i })
    const increaseBtnAfter = increaseBtnsAfter.first()

    await expect(bookingQtyAfter).toHaveText('1', { timeout: 10_000 })
    await expect(increaseBtnsAfter).toHaveCount(1, { timeout: 10_000 })
    await expect(increaseBtnAfter).toBeEnabled({ timeout: 10_000 })

    // With capacity=3 and 1 confirmed booking, user can increase to 3 total.
    await increaseBtnAfter.click()
    await expect(bookingQtyAfter).toHaveText('2', { timeout: 5_000 })
    await increaseBtnAfter.click()
    await expect(bookingQtyAfter).toHaveText('3', { timeout: 5_000 })
    await expect(increaseBtnAfter).toBeDisabled({ timeout: 5_000 })

    // Verify the fix survives a re-set + re-clear cycle.
    await payload.update({
      collection: 'class-pass-types',
      id: classPassType.id,
      data: { maxBookingsPerTimeslot: 1 },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'class-pass-types',
      id: classPassType.id,
      data: { maxBookingsPerTimeslot: null },
      overrideAccess: true,
    })
    const cpAfterResetAndClear = await payload.findByID({
      collection: 'class-pass-types',
      id: classPassType.id,
      depth: 0,
      overrideAccess: true,
    })
    expect((cpAfterResetAndClear as any)?.maxBookingsPerTimeslot).toBeNull()
  })

  /**
   * Manage page (checkout): the + button must be capped by the per-user/payment-method
   * `maxBookingsPerTimeslot`, adjusted by already-held confirmed bookings.
   *
   * Regression target:
   * - When the user already has confirmed bookings, the checkout “increase new bookings”
   *   cap must be computed as (viewerMaxPerTimeslot - confirmedBookings.length), not
   *   just from timeslot remaining capacity.
   *
   * Setup:
   * - class-pass maxBookingsPerTimeslot = 2
   * - user has 1 confirmed booking for the timeslot
   * - timeslot capacity is large (so remaining capacity >> 1)
   *
   * Expected:
   * - At checkout entry: pendingQty = 1 (they increased desired total from 1 → 2)
   * - Therefore checkout "+" must be disabled immediately (max additional pending = 1)
   */
  test.skip('manage page (checkout): + button disabled when pending reaches method cap (confirmed-aware)', async ({
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

    // Class-pass type with a numeric per-timeslot cap of exactly 2.
    const classPassType = (await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Checkout Method Cap CP ${tenant.id}-w${workerIndex}-${Date.now()}`,
        slug: `checkout-method-cap-cp-${tenant.id}-w${workerIndex}-${Date.now()}`,
        quantity: 10,
        tenant: tenant.id,
        maxBookingsPerTimeslot: 2,
        priceInformation: { price: 24.99 },
        skipSync: true,
        stripeProductId: `prod_checkout_method_cap_${tenant.id}_${workerIndex}_${Date.now()}`,
      },
      overrideAccess: true,
    })) as { id: number }

    // Give the user a class pass so the class-pass tab/payment method is available.
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
        status: 'active',
      },
      overrideAccess: true,
    })

    // Event type with ample capacity so remaining capacity >> method cap.
    const eventType = await createTestEventType(
      tenant.id,
      'Checkout Method Cap (Class Pass)',
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
    startTime.setHours(11, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 4 + workerIndex)

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

    // User already holds 1 confirmed booking and 1 pending booking.
    // This puts the manage page directly into checkout state on load.
    await createTestBooking(user.id, timeslot.id, 'confirmed')
    await createTestBooking(user.id, timeslot.id, 'pending')

    await loginAsRegularUser(page, 1, user.email, 'password', { tenantSlug: tenant.slug })
    await page.waitForTimeout(process.env.CI ? 3000 : 1500)

    await openManagePage({
      page,
      tenantSlug: tenant.slug,
      userEmail: user.email,
      lessonId: timeslot.id,
      expectedState: 'checkout',
    })

    // With confirmed=1, viewer max=2 → max additional pending = 1.
    const pendingQty = page.getByTestId('pending-booking-quantity')
    await expect(pendingQty).toHaveText('1', { timeout: 10000 })

    const canAddText = page.getByText(/You can add up to/i).first()
    const canAddContent = await canAddText.textContent()
    const maxPendingMatch = canAddContent?.match(/up to\s+(\d+)/i)
    expect(maxPendingMatch?.[1]).toBe('1')

    const increaseNewBtn = page.getByRole('button', { name: /increase new bookings/i })
    await expect(increaseNewBtn).toBeDisabled({ timeout: 5000 })

    const decreaseNewBtn = page.getByRole('button', { name: /decrease new bookings/i })
    await expect(decreaseNewBtn).toBeEnabled()
  })
})

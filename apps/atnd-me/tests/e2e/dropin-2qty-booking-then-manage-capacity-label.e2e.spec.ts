/**
 * Drop-in booking (quantity 2) → manage page: capacity label accuracy
 *
 * Scenario:
 *  1. An adjustable drop-in is configured with no per-user cap so only the timeslot's
 *     venue capacity (event-types.places) is the binding limit.
 *  2. The user books 2 slots in a single session via the drop-in tab using a 100%-off
 *     promo code (avoids Stripe card entry while exercising the real payment flow).
 *  3. The user navigates to the manage page for the same timeslot.
 *  4. The "Up to X total bookings available for this timeslot." label must display
 *     X = places (the full venue capacity), because:
 *       X = activeBookings.length + timeslot.remainingCapacity
 *         = 2             + (places − 2)
 *         = places
 *  5. The increase button is still enabled (remaining capacity > 0) and the user
 *     can raise their desired total to 3, confirming the manage flow is functional.
 */
import { test, expect } from './helpers/fixtures'
import type { Page } from '@playwright/test'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

/** Navigate to the manage page and wait for the quantity view to be visible. */
async function openManagePage(args: {
  page: Page
  tenantSlug: string
  userEmail: string
  password: string
  lessonId: number
}) {
  const { page, tenantSlug, userEmail, password, lessonId } = args

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, `/bookings/${lessonId}/manage`)

    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUserViaApi(page, userEmail, password, { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)

    const outcome = await Promise.race([
      page
        .getByText(/update booking quantity/i)
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'quantity' as const),
      page
        .getByRole('heading', { name: /booking page error/i })
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'quantity') return
    if (attempt < 2) {
      await loginAsRegularUserViaApi(page, userEmail, password, { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(
    `Failed to reach manage page quantity view for lesson ${lessonId}. URL: ${page.url()}`,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Drop-in booking (qty 2) then manage: capacity label reflects actual places', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test(
    '"Up to X total bookings available" on manage page shows X = timeslot capacity after booking 2 slots via drop-in',
    async ({ page, testData }) => {
      /** Total venue capacity configured on the event-type. */
      const CAPACITY = 5
      /** Number of slots booked in the first step. */
      const BOOKED_QTY = 2

      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const workerIndex = testData.workerIndex
      const password = 'password'

      // ── Setup ─────────────────────────────────────────────────────────────

      // Enable Stripe Connect so the drop-in tab appears on the booking page.
      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          // Format must match /^acct_[a-z_]+_\d+$/ so that the test-account guard
          // in coupons.ts returns a synthetic coupon instead of hitting the real Stripe API.
          stripeConnectAccountId: `acct_dropin_caplbl_${tenant.id}`,
        },
        overrideAccess: true,
      })

      // 100%-off promo so the booking can be completed without a real Stripe card.
      const promoCode = `CAPLBL${tenant.id}${workerIndex}`.slice(0, 24).toUpperCase()
      await payload.create({
        collection: 'discount-codes',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          name: `Capacity label promo ${tenant.id}-w${workerIndex}`,
          code: promoCode,
          type: 'percentage_off',
          value: 100,
          duration: 'once',
          tenant: tenant.id,
        } as any,
        overrideAccess: true,
      })

      // Adjustable drop-in — no maxBookingsPerTimeslot, so viewerMaxPerTimeslot = Infinity.
      // Only the venue capacity (places) limits how many slots the user can hold.
      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `Cap Label Drop-in ${tenant.id}-w${workerIndex}-${Date.now()}`,
          isActive: true,
          price: 10,
          adjustable: true,
          tenant: tenant.id,
        },
        overrideAccess: true,
      })) as { id: number }

      // Event type with a known venue capacity (CAPACITY).
      const classOption = await createTestEventType(
        tenant.id,
        'Capacity Label Class',
        CAPACITY,
        undefined,
        workerIndex,
      )
      await payload.update({
        collection: 'event-types',
        id: classOption.id,
        data: {
          paymentMethods: { allowedDropIn: dropIn.id },
          tenant: tenant.id,
        },
        overrideAccess: true,
      })

      // Fresh timeslot scoped to this worker to avoid cross-test capacity interference.
      const startTime = new Date()
      startTime.setHours(10, 0, 0, 0)
      startTime.setDate(startTime.getDate() + 4 + workerIndex)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      const lesson = await createTestTimeslot(
        tenant.id,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true,
      )

      // ── Step 1: book 2 slots via drop-in (100% promo) ─────────────────────

      await loginAsRegularUserViaApi(page, user.email, password, { tenantSlug: tenant.slug })

      await navigateToTenant(page, tenant.slug, `/bookings/${lesson.id}`)
      await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}$`), { timeout: 30_000 })

      // Wait for the payment-method heading, then switch to the Drop-in tab.
      await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
        timeout: 30_000,
      })

      // ── Rapid-click regression guard ──────────────────────────────────────
      // Bug: rapidly clicking the quantity selector spawned one
      // create-payment-intent (and upsertCheckoutHold) per click, exhausting the
      // DB connection pool and hanging the entire app.
      // Fix: 350ms debounce on debouncedQuantity + 100ms abort-aware delay in
      //      CheckoutForm. At most 1 PI may be in flight after a rapid burst.
      //
      // Drop-in is the default tab so CheckoutForm mounts immediately; wait for its
      // initial PI to complete (signalled by the payment placeholder appearing) so the
      // burst counter only captures PIs triggered by the rapid clicks themselves.
      const stripeNotConfigured = page.getByTestId('stripe-not-configured')
      const paymentForm = page.locator('#payment-form')
      await expect(stripeNotConfigured.or(paymentForm)).toBeVisible({ timeout: 20_000 })

      let concurrentPiRequests = 0
      let maxConcurrentPiRequests = 0
      const onPiRequest = (req: { url: () => string; method: () => string }) => {
        if (
          req.url().includes('/api/stripe/connect/create-payment-intent') &&
          req.method() === 'POST'
        ) {
          concurrentPiRequests++
          maxConcurrentPiRequests = Math.max(maxConcurrentPiRequests, concurrentPiRequests)
        }
      }
      const onPiDone = (req: { url: () => string; method: () => string }) => {
        if (
          req.url().includes('/api/stripe/connect/create-payment-intent') &&
          req.method() === 'POST'
        ) {
          concurrentPiRequests = Math.max(0, concurrentPiRequests - 1)
        }
      }
      page.on('request', onPiRequest)
      page.on('requestfinished', onPiDone)
      page.on('requestfailed', onPiDone)

      // Rapid-fire 4 clicks on the top-level quantity selector via evaluate so all 4
      // land in the same browser microtask batch — guaranteed within the 350ms debounce.
      const increaseQtyBtnSelector = 'button[aria-label="Increase quantity"]'
      await page.waitForSelector(increaseQtyBtnSelector, { timeout: 10_000 })
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel) as HTMLButtonElement | null
        if (btn) {
          btn.click()
          btn.click()
          btn.click()
          btn.click()
        }
      }, increaseQtyBtnSelector)

      // Wait past debounce (350ms) + abort-aware delay (100ms) + generous buffer.
      await page.waitForTimeout(700)

      page.off('request', onPiRequest)
      page.off('requestfinished', onPiDone)
      page.off('requestfailed', onPiDone)

      // Debounce + abort-aware delay must collapse 4 rapid clicks into ≤ 1 concurrent PI.
      expect(
        maxConcurrentPiRequests,
        `Rapid quantity clicks spawned ${maxConcurrentPiRequests} concurrent PI requests — DB pool exhaustion regression`,
      ).toBeLessThanOrEqual(1)

      // Reset quantity back to 1 so the booking flow below starts from the correct state.
      // (4 rapid increases brought quantity to 5; decrease 4 times to return to 1.)
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel) as HTMLButtonElement | null
        if (btn) {
          btn.click()
          btn.click()
          btn.click()
          btn.click()
        }
      }, 'button[aria-label="Decrease quantity"]')
      // Wait for the debounce to settle on quantity=1 so subsequent + clicks work correctly.
      await page.waitForTimeout(500)
      // ──────────────────────────────────────────────────────────────────────

      await page.getByRole('tab', { name: /drop-?in/i }).click()

      // The drop-in tab exposes its own quantity selector.
      // Increase from 1 → BOOKED_QTY.
      const increaseQtyBtn = page.getByRole('button', { name: /increase quantity/i }).first()
      await expect(increaseQtyBtn).toBeVisible({ timeout: 10_000 })
      await expect(increaseQtyBtn).toBeEnabled({ timeout: 10_000 })

      for (let i = 1; i < BOOKED_QTY; i++) {
        await increaseQtyBtn.click()
      }

      // Verify the quantity value displayed inside the drop-in tab selector.
      const qtyValue = increaseQtyBtn.locator('xpath=preceding-sibling::span[1]')
      await expect(qtyValue).toHaveText(String(BOOKED_QTY), { timeout: 10_000 })

      // Wait for the debounce (350ms) + abort-aware delay (100ms) to settle so that
      // debouncedQuantity=BOOKED_QTY has propagated to PaymentMethods/CheckoutForm and
      // the checkout hold is upserted for the correct quantity before we apply the promo.
      // Without this wait the hold can still be at qty=1 when the promo fires, causing
      // only 1 booking to be confirmed instead of BOOKED_QTY.
      await page.waitForTimeout(600)

      // Set up the response listener before clicking Apply (race-safe pattern used
      // throughout the existing drop-in tests).
      const zeroAmountPI = page.waitForResponse(
        (res) => {
          if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
          if (res.request().method() !== 'POST') return false
          const postData = res.request().postData()
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

      // Apply the 100%-off promo — the total drops to €0 and a free-booking intent fires.
      await page.getByLabel('Promo code').fill(promoCode)
      await page.getByRole('button', { name: /^Apply$/i }).click()
      await Promise.all([
        expect(page.getByText(/promo code applied/i)).toBeVisible({ timeout: 15_000 }),
        zeroAmountPI,
      ])

      const piRes = await zeroAmountPI
      expect(
        piRes.ok(),
        `create-payment-intent (€0) failed: ${piRes.status()} ${await piRes.text()}`,
      ).toBeTruthy()

      // Verify the displayed total is €0.
      await expect(page.getByTestId('total')).toHaveText('€0.00')

      // Complete the free booking.
      await expect(page.getByTestId('complete-free-booking')).toBeVisible({ timeout: 10_000 })
      await page.getByTestId('complete-free-booking').click()

      await page.waitForURL(/\/success\?/, { timeout: 20_000 })
      await expect(page.getByRole('heading', { name: /thank you!/i })).toBeVisible({
        timeout: 15_000,
      })

      // Sanity-check: exactly BOOKED_QTY confirmed bookings exist in the database.
      const bookingsAfter = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { timeslot: { equals: lesson.id } },
            { user: { equals: Number(user.id) } },
            { status: { equals: 'confirmed' } },
          ],
        },
        limit: BOOKED_QTY + 5,
        depth: 0,
        overrideAccess: true,
      })
      expect(bookingsAfter.totalDocs).toBe(BOOKED_QTY)

      // ── Step 2: manage the booking and verify the capacity label ──────────

      await openManagePage({
        page,
        tenantSlug: tenant.slug,
        userEmail: user.email,
        password,
        lessonId: lesson.id,
      })

      await expect(page.getByText(/update booking quantity/i).first()).toBeVisible({
        timeout: 15_000,
      })

      // The manage page's quantity display must show BOOKED_QTY.
      const bookingQty = page.getByTestId('booking-quantity')
      await expect(bookingQty).toHaveText(String(BOOKED_QTY), { timeout: 10_000 })

      // ── Key assertion: the capacity label shows the full venue capacity ──────
      //
      //   "Up to X total bookings available for this timeslot."
      //
      // The component computes:
      //   maxTotalQuantityBase = activeBookings.length + timeslot.remainingCapacity
      //                        = BOOKED_QTY          + (CAPACITY − BOOKED_QTY)
      //                        = CAPACITY
      //
      // Since viewerMaxPerTimeslot = Infinity (adjustable drop-in, no per-user cap),
      // maxTotalQuantity = maxTotalQuantityBase = CAPACITY.
      //
      // If the label shows a number smaller than CAPACITY, the remaining-capacity
      // calculation is wrong (e.g. confirmed bookings are being double-counted).
      const expectedMax: number = CAPACITY
      const bookingPlural = expectedMax !== 1 ? 's' : ''
      await expect(
        page.getByText(
          new RegExp(
            `Up to ${expectedMax} total booking${bookingPlural} available for this timeslot`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 })

      // ── Step 3: click + all the way to the capacity limit ────────────────

      // The + button must be enabled — remaining capacity (CAPACITY − BOOKED_QTY = 3) > 0.
      const increaseBtn = page.getByRole('button', { name: /increase quantity/i }).first()
      await expect(increaseBtn).toBeVisible({ timeout: 10_000 })
      await expect(increaseBtn).toBeEnabled({ timeout: 10_000 })

      // Click + until the desired total reaches CAPACITY.
      // The loop runs exactly (CAPACITY − BOOKED_QTY) times; the counter `i` is the
      // current confirmed qty before each click.
      for (let i = BOOKED_QTY; i < CAPACITY; i++) {
        await increaseBtn.click()
        await expect(bookingQty).toHaveText(String(i + 1), { timeout: 5_000 })
      }

      // At CAPACITY the + button must become disabled (no remaining slots).
      await expect(increaseBtn).toBeDisabled({ timeout: 5_000 })
      await expect(bookingQty).toHaveText(String(CAPACITY), { timeout: 5_000 })

      // ── Step 4: click "Update Bookings" and assert the payment form appears ─

      // Watch for the create-payment-intent call that fires when the checkout view mounts.
      // Price must be > 0: the user is paying for (CAPACITY − BOOKED_QTY) additional slots.
      const managePI = page.waitForResponse(
        (res) => {
          if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
          if (res.request().method() !== 'POST') return false
          const postData = res.request().postData()
          if (!postData) return false
          try {
            const body = JSON.parse(postData) as { price?: number }
            return typeof body.price === 'number' && body.price > 0
          } catch {
            return false
          }
        },
        { timeout: 30_000 },
      )

      const updateBtn = page.getByRole('button', { name: /update bookings/i })
      await expect(updateBtn).toBeEnabled({ timeout: 5_000 })
      await updateBtn.click()

      // The checkout view must appear: "New Bookings to Pay For" + "Complete Payment".
      await expect(page.getByText(/new bookings to pay for/i).first()).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByText(/complete payment/i).first()).toBeVisible({ timeout: 10_000 })

      // The PI call must have succeeded.
      const piRes2 = await managePI
      expect(
        piRes2.ok(),
        `manage create-payment-intent failed: ${piRes2.status()} ${await piRes2.text()}`,
      ).toBeTruthy()

      // The Drop-in tab must be present in the payment form.
      await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible({ timeout: 10_000 })

      // The payment form renders in one of two states depending on the environment:
      //   • form#payment-form                    — real Stripe PaymentElement (production)
      //   • [data-testid="stripe-not-configured"] — test-mode mock placeholder, shown when
      //     the PI returns a synthetic client secret (pi_test_…_secret_test) which is what
      //     create-payment-intent emits when using the fake stripeConnectAccountId in this test.
      // Either being visible confirms the payment component mounted and received the PI.
      const stripeForm = page.locator('#payment-form')
      const stripeTestMock = page.getByTestId('stripe-not-configured')
      await expect(stripeForm.or(stripeTestMock)).toBeVisible({ timeout: 15_000 })

      // ── Step 5: checkout hold quantity cap enforcement ────────────────────
      //
      // At checkout entry the component computes:
      //   checkoutMax = computeCheckoutMax(remainingCapacity, viewerMaxPerTimeslot, confirmedCount)
      //               = computeCheckoutMax(CAPACITY − BOOKED_QTY, Infinity, BOOKED_QTY)
      //               = CAPACITY − BOOKED_QTY   (= 3)
      //
      // The hold is created for delta = desiredTotal − confirmedCount = CAPACITY − BOOKED_QTY slots.
      // So immediately after entering checkout:
      //   pendingQty  = hold.quantity = 3  (= checkoutMax)
      //   pendingQty >= checkoutMax        → "Increase new bookings" must be disabled.
      //
      // This is the checkout-holds mode cap: the hold already occupies all remaining
      // capacity, so the user cannot increase the pending quantity further.
      const expectedHoldQty = CAPACITY - BOOKED_QTY // 3

      // "You can add up to N new bookings for this timeslot." — N must equal checkoutMax.
      await expect(
        page.getByText(
          new RegExp(
            `You can add up to ${expectedHoldQty} new booking${expectedHoldQty !== 1 ? 's' : ''} for this timeslot`,
            'i',
          ),
        ),
      ).toBeVisible({ timeout: 10_000 })

      // The pending quantity counter must show the hold size (all remaining capacity).
      const pendingQty = page.getByTestId('pending-booking-quantity')
      await expect(pendingQty).toHaveText(String(expectedHoldQty), { timeout: 10_000 })

      // "Increase new bookings" must be disabled: hold already at checkoutMax.
      const increaseNewBtn = page.getByRole('button', { name: /increase new bookings/i })
      await expect(increaseNewBtn).toBeVisible({ timeout: 10_000 })
      await expect(increaseNewBtn).toBeDisabled({ timeout: 5_000 })

      // "Decrease new bookings" must still be enabled: user can reduce the hold.
      const decreaseNewBtn = page.getByRole('button', { name: /decrease new bookings/i })
      await expect(decreaseNewBtn).toBeVisible({ timeout: 10_000 })
      await expect(decreaseNewBtn).toBeEnabled({ timeout: 5_000 })
    },
  )
})

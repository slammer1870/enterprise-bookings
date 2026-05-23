/**
 * Booking page: payment method tab filtering by selected quantity
 *
 * Verifies that the PaymentMethods component shows or hides each tab (Drop-in,
 * Class pass, Membership) as the user adjusts the quantity selector on
 * /bookings/[id], according to each payment type's `maxBookingsPerTimeslot` cap.
 *
 * Test setup
 * ──────────
 *   • Drop-in          : adjustable=false  → maxBookingsPerTimeslot=1
 *   • Class pass type  : maxBookingsPerTimeslot=2, user holds 4 credits
 *   • Membership plan  : maxBookingsPerTimeslot=3, user has NO subscription
 *     (the plan is available-to-purchase, so the Membership tab shows)
 *   • Timeslot capacity: 5  (method caps are the binding constraint, not capacity)
 *
 * Expected behaviour
 * ──────────────────
 *   qty=1  → Drop-in ✓  Class-pass ✓  Membership ✓
 *   qty=2  → Drop-in ✗  Class-pass ✓  Membership ✓   (drop-in max=1 < 2)
 *   qty=3  → Drop-in ✗  Class-pass ✗  Membership ✓   (class-pass max=2 < 3)
 *   qty=4  → unreachable: the + button is disabled at qty=3
 *            because viewerMax = max(1, 2, 3) = 3 = maxQuantity
 *            This is the UI's way of communicating "no more than 3 spots".
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUser } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Navigate to the booking page and wait for the quantity selector / payment methods to render. */
async function openBookingPageWithPaymentMethods(args: {
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
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'quantity' as const),
      page
        .getByRole('heading', { name: /booking page error/i })
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'quantity') return

    if (attempt < 2) {
      await loginAsRegularUser(page, 1, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(
    `Failed to load booking page for timeslot ${lessonId}. URL: ${page.url()}`
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Booking page: payment method tab filtering by quantity', () => {
  test.describe.configure({ timeout: 180_000 })

  /**
   * Core filtering scenario.
   *
   * Each quantity step removes one more payment method tab:
   *   qty 1 → all three visible
   *   qty 2 → drop-in gone (max=1 < 2)
   *   qty 3 → class-pass also gone (max=2 < 3); only membership remains
   *   qty 4 → unreachable: + button disabled at qty=3 (no method allows >3)
   */
  test(
    'tabs filter correctly as quantity increases across drop-in, class-pass and membership caps',
    async ({ page, testData }) => {
      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const w = testData.workerIndex
      const ts = Date.now()

      // ── Stripe Connect must be "active" for payment methods to be visible ──
      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: null,
        },
        overrideAccess: true,
      })

      // ── Drop-in: single-slot only (max=1) ─────────────────────────────────
      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `Tab Filter Drop-in ${tenant.id}-w${w}-${ts}`,
          isActive: true,
          price: 15,
          adjustable: false,   // beforeValidate maps this → maxBookingsPerTimeslot: 1
          tenant: tenant.id,
        },
        overrideAccess: true,
      })) as { id: number }

      // ── Class pass type: max 2 per timeslot ───────────────────────────────
      const classPassType = (await payload.create({
        collection: 'class-pass-types',
        data: {
          name: `Tab Filter Class Pass ${tenant.id}-w${w}-${ts}`,
          slug: `tab-filter-cp-${tenant.id}-${w}-${ts}`,
          quantity: 10,
          tenant: tenant.id,
          maxBookingsPerTimeslot: 2,
          priceInformation: { price: 29.99 },
          skipSync: true,
          stripeProductId: `prod_tabfilter_cp_${tenant.id}_${w}_${ts}`,
        },
        overrideAccess: true,
      })) as { id: number }

      // Give the user a class pass with plenty of credits (4) so the class-pass
      // tab is driven by the TYPE cap, not by insufficient credits.
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await payload.create({
        collection: 'class-passes',
        data: {
          user: user.id,
          tenant: tenant.id,
          type: classPassType.id,
          quantity: 4,
          expirationDate: expiry.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        },
        overrideAccess: true,
      })

      // ── Membership plan: max 3 per timeslot ───────────────────────────────
      // Create directly (not via createTestPlan) so we can set the numeric cap
      // without triggering the `allowMultipleBookingsPerTimeslot` legacy mapping.
      const plan = (await payload.create({
        collection: 'plans',
        data: {
          tenant: tenant.id,
          name: `Tab Filter Plan ${tenant.id}-w${w}-${ts}`,
          status: 'active',
          skipSync: true,
          sessionsInformation: {
            sessions: 20,
            interval: 'week',
            intervalCount: 1,
            maxBookingsPerTimeslot: 3,
          },
          stripeProductId: `prod_tabfilter_plan_${tenant.id}_${w}_${ts}`,
          priceJSON: JSON.stringify({
            id: `price_tabfilter_plan_${tenant.id}_${w}_${ts}`,
          }),
        },
        overrideAccess: true,
      })) as { id: number }

      // No subscription for the user — the membership tab shows because there
      // is an active plan available to purchase (activePlans.length > 0).

      // ── Event type (capacity=5) with all three payment methods ─────────────
      const eventType = await createTestEventType(
        tenant.id,
        'Tab Filter Payment Methods',
        5,
        undefined,
        w
      )

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: {
          paymentMethods: {
            allowedDropIn: dropIn.id,
            allowedPlans: [plan.id],
            allowedClassPasses: [classPassType.id],
          },
        },
        overrideAccess: true,
      })

      // Timeslot starting 4+ days in the future (per-worker offset avoids conflicts).
      const startTime = new Date()
      startTime.setHours(14, 0, 0, 0)
      startTime.setDate(startTime.getDate() + 4 + w)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const timeslot = await createTestTimeslot(
        tenant.id,
        eventType.id,
        startTime,
        endTime,
        undefined,
        true
      )

      // ── Authenticate and navigate ──────────────────────────────────────────
      await loginAsRegularUser(page, 1, user.email, 'password', {
        tenantSlug: tenant.slug,
      })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)

      await openBookingPageWithPaymentMethods({
        page,
        tenantSlug: tenant.slug,
        userEmail: user.email,
        lessonId: timeslot.id,
      })

      // ── qty=1: all three payment method tabs must be visible ───────────────
      await test.step('qty=1 — all three tabs visible', async () => {
        // Wait for the PaymentMethods section to fully render.
        await expect(page.getByText(/payment methods/i).first()).toBeVisible({
          timeout: 20000,
        })

        await expect(
          page.getByRole('tab', { name: /membership/i })
        ).toBeVisible({ timeout: 15000 })

        await expect(
          page.getByRole('tab', { name: /class pass/i })
        ).toBeVisible({ timeout: 10000 })

        await expect(
          page.getByRole('tab', { name: /drop-?in/i })
        ).toBeVisible({ timeout: 10000 })
      })

      // The quantity selector lives in the "Select Quantity" card above payment methods.
      const increaseBtn = page
        .getByRole('button', { name: /increase quantity/i })
        .first()
      const decreaseBtn = page
        .getByRole('button', { name: /decrease quantity/i })
        .first()

      // ── qty=2: drop-in tab disappears (max=1 < 2) ─────────────────────────
      await test.step('qty=2 — drop-in tab disappears (its max=1 cannot cover 2 bookings)', async () => {
        await expect(increaseBtn).toBeEnabled({ timeout: 10000 })
        await increaseBtn.click()

        // Drop-in tab must vanish because dropInAllowsQuantity(dropIn, 2) = false.
        await expect(
          page.getByRole('tab', { name: /drop-?in/i })
        ).not.toBeVisible({ timeout: 10000 })

        // Class pass (max=2) and membership (max=3) still support qty=2.
        await expect(
          page.getByRole('tab', { name: /class pass/i })
        ).toBeVisible({ timeout: 10000 })
        await expect(
          page.getByRole('tab', { name: /membership/i })
        ).toBeVisible({ timeout: 10000 })
      })

      // ── qty=3: class-pass tab also disappears (max=2 < 3) ─────────────────
      await test.step('qty=3 — class-pass tab disappears (its max=2 cannot cover 3 bookings); only membership remains', async () => {
        await expect(increaseBtn).toBeEnabled({ timeout: 10000 })
        await increaseBtn.click()

        // Class-pass type max=2 is exceeded; the tab is no longer rendered
        // (anyClassPassTypeAllowsQuantity=false once every type cap is exceeded).
        await expect(
          page.getByRole('tab', { name: /class pass/i })
        ).not.toBeVisible({ timeout: 15000 })

        // Drop-in tab should still be absent.
        await expect(
          page.getByRole('tab', { name: /drop-?in/i })
        ).not.toBeVisible()

        // Membership plan (max=3) still covers qty=3 — tab must remain.
        await expect(
          page.getByRole('tab', { name: /membership/i })
        ).toBeVisible({ timeout: 10000 })
      })

      // ── qty=4: unreachable — + button disabled at qty=3 ───────────────────
      await test.step('qty=4 is blocked — the + button is disabled at qty=3 because no payment method allows more than 3 bookings per timeslot', async () => {
        // viewerMaxFromPaymentOptions = max(drop-in=1, membership=3, class-pass=2) = 3.
        // maxQuantity = min(capacity=5, 3) = 3.
        // The QuantitySelector disables + once quantity reaches maxQuantity.
        await expect(increaseBtn).toBeDisabled({ timeout: 5000 })

        // − button stays enabled so the user can reduce their selection.
        await expect(decreaseBtn).toBeEnabled()
      })

      // ── qty back to 2: class-pass tab reappears ───────────────────────────
      await test.step('decreasing back to qty=2 restores the class-pass tab', async () => {
        await decreaseBtn.click()

        await expect(
          page.getByRole('tab', { name: /class pass/i })
        ).toBeVisible({ timeout: 15000 })

        // Drop-in (max=1) should remain absent at qty=2.
        await expect(
          page.getByRole('tab', { name: /drop-?in/i })
        ).not.toBeVisible()
      })
    }
  )
})

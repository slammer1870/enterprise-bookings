import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestBooking,
  createTestEventType,
  createTestTimeslot,
  createTestPlan,
  createTestSubscription,
  updateTenantStripeConnect,
  getPayloadInstance,
} from './helpers/data-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

/**
 * Navigate to the manage page and wait for the "Update booking quantity" view.
 * Retries on auth redirects and error pages.
 */
async function openManagePageAtQuantityView(args: {
  page: Parameters<typeof test>[0]['page']
  tenantSlug: string
  userEmail: string
  lessonId: number
}) {
  const { page, tenantSlug, userEmail, lessonId } = args
  const quantityHeading = page.getByText(/update booking quantity/i).first()
  const errorHeading = page.getByRole('heading', { name: /booking page error/i })
  const managePath = `/bookings/${lessonId}/manage`

  for (let attempt = 0; attempt < 3; attempt++) {
    await navigateToTenant(page, tenantSlug, managePath)

    if (page.url().includes('/auth/sign-in')) {
      await loginAsRegularUserViaApi(page, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
      continue
    }

    await page.waitForLoadState('load').catch(() => null)

    const outcome = await Promise.race([
      quantityHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'quantity' as const),
      errorHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'error' as const),
    ]).catch(() => null)

    if (outcome === 'quantity') return
    if (attempt < 2) {
      await loginAsRegularUserViaApi(page, userEmail, 'password', { tenantSlug })
      await page.waitForTimeout(process.env.CI ? 3000 : 1500)
    }
  }

  throw new Error(
    `Failed to reach manage page quantity view for lesson ${lessonId}. URL: ${page.url()}`,
  )
}

test.describe('Single-slot membership upgrade options on manage booking', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  /**
   * Scenario:
   *   A user holds an active membership with maxBookingsPerTimeslot = 1
   *   (expressed via allowMultipleBookingsPerTimeslot: false).  They already
   *   have one confirmed booking on a timeslot and try to add more via the
   *   manage page.
   *
   *   Expected behaviour:
   *   - "Use my membership" is NOT offered (their plan can't cover qty > 1).
   *   - Only plans with maxBookingsPerTimeslot > 1 appear as upgrade options.
   *   - A plan that is also capped at 1 (ineligibleOtherPlan) is NOT shown.
   *
   *   How it works:
   *   - Increasing to qty=3 creates 2 pending bookings (pendingQuantity=2).
   *   - PaymentMethods passes quantity=2 to getSubscriptionForTimeslot.
   *   - The server's eligiblePlansForQuantity filter excludes cap=1 plans.
   *   - plansForView therefore contains only the multi-slot upgrade plan.
   *   - PlanView sees !hasMatchingPlan (currentPlan not in plansForView) and
   *     renders "Upgrade Subscription" cards for the eligible plan only.
   */
  test(
    'blocks reuse of single-slot membership and shows only cap>1 upgrade plans',
    async ({ page, testData }) => {
      const payload = await getPayloadInstance()
      const tenant = testData.tenants[0]!
      const user = testData.users.user1
      const workerIndex = testData.workerIndex

      // Enable Stripe Connect so membership payment methods are active on the tenant.
      // stripeConnectAccountId: null keeps us in test mode (no real Stripe account).
      await updateTenantStripeConnect(tenant.id, {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      })

      // ── Create three plans ──────────────────────────────────────────────────
      //
      // currentPlan (cap=1): what the user is subscribed to.
      // eligibleUpgradePlan (cap=∞): the only plan that should appear as an option.
      // ineligibleOtherPlan (cap=1): must NOT appear — same cap as current plan.

      const ts = Date.now()

      const currentPlan = await createTestPlan({
        tenantId: tenant.id,
        name: `Cap1 Current ${tenant.id}-w${workerIndex}-${ts}`,
        sessions: 10,
        allowMultipleBookingsPerTimeslot: false,
        stripeProductId: `prod_cap1_current_${workerIndex}_${ts}`,
        priceId: `price_cap1_current_${workerIndex}_${ts}`,
      })

      const eligibleUpgradePlanName = `Multi Upgrade ${tenant.id}-w${workerIndex}-${ts}`
      const eligibleUpgradePlan = await createTestPlan({
        tenantId: tenant.id,
        name: eligibleUpgradePlanName,
        sessions: 10,
        allowMultipleBookingsPerTimeslot: true,
        stripeProductId: `prod_multi_upgrade_${workerIndex}_${ts}`,
        priceId: `price_multi_upgrade_${workerIndex}_${ts}`,
      })

      const ineligibleOtherPlanName = `Cap1 Other ${tenant.id}-w${workerIndex}-${ts}`
      const ineligibleOtherPlan = await createTestPlan({
        tenantId: tenant.id,
        name: ineligibleOtherPlanName,
        sessions: 10,
        allowMultipleBookingsPerTimeslot: false,
        stripeProductId: `prod_cap1_other_${workerIndex}_${ts}`,
        priceId: `price_cap1_other_${workerIndex}_${ts}`,
      })

      // ── Create event type and set all three plans as allowed ────────────────

      const classOption = await createTestEventType(
        tenant.id,
        'Membership Cap Upgrade Options',
        10,
        undefined,
        workerIndex,
      )

      // Explicitly set allowedDropIn and allowedClassPasses to null/[] so the
      // only payment method tab shown is Membership.
      await payload.update({
        collection: 'event-types',
        id: classOption.id,
        data: {
          paymentMethods: {
            allowedPlans: [currentPlan.id, eligibleUpgradePlan.id, ineligibleOtherPlan.id],
            allowedDropIn: null,
            allowedClassPasses: [],
          },
        },
        overrideAccess: true,
      })

      // ── Create timeslot ──────────────────────────────────────────────────────

      const startTime = new Date()
      startTime.setHours(9, 0, 0, 0)
      startTime.setDate(startTime.getDate() + 1 + workerIndex)
      const endTime = new Date(startTime)
      endTime.setHours(10, 0, 0, 0)

      const lesson = await createTestTimeslot(
        tenant.id,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true,
      )

      // ── Create the initial confirmed booking (made "with" the membership) ───

      await createTestBooking(user.id, lesson.id, 'confirmed')

      // ── Create an active subscription for the single-slot plan ───────────────

      await createTestSubscription({
        userId: user.id,
        tenantId: tenant.id,
        planId: currentPlan.id,
        status: 'active',
        stripeSubscriptionId: null,
        stripeCustomerId: `cus_cap1_mgmt_${workerIndex}`,
        stripeAccountId: null,
      })

      // ── Login ────────────────────────────────────────────────────────────────

      await loginAsRegularUserViaApi(page, user.email, 'password', {
        tenantSlug: tenant.slug,
      })

      // ── Navigate to manage page and assert starting state ────────────────────

      await openManagePageAtQuantityView({
        page,
        tenantSlug: tenant.slug,
        userEmail: user.email,
        lessonId: lesson.id,
      })

      const bookingQuantity = page.getByTestId('booking-quantity')
      await expect(bookingQuantity).toHaveText('1', { timeout: 10000 })

      // The increase button must be visible: computeViewerMax sees the
      // eligibleUpgradePlan (cap=∞) among allowedPlans and returns ∞.
      const increaseButton = page.getByRole('button', { name: /increase quantity/i })
      await expect(increaseButton).toBeEnabled({ timeout: 10000 })

    // ── Increase to qty=2 (one click) → creates 1 pending booking ──────────
    //
    // The user already has 1 confirmed booking (the baseline slot they paid
    // for with their cap=1 membership).  Adding 1 more brings the total to 2,
    // which exceeds the plan's maxBookingsPerTimeslot=1 cap.
    //
    // getSubscriptionForTimeslot now counts confirmedForTimeslot (=1) and
    // uses effectiveQuantity = 1 confirmed + 1 pending = 2 for the
    // eligiblePlansForQuantity filter, excluding cap=1 plans.

    await increaseButton.click()
    await expect(bookingQuantity).toHaveText('2', { timeout: 5000 })

      // ── Click Update Bookings — wait for checkout hold to be created ─────────

      const holdResponse = page.waitForResponse(
        (r) =>
          r.url().includes('bookings.upsertCheckoutHold') &&
          r.request().method() === 'POST' &&
          r.status() === 200,
        { timeout: 30000 },
      )
      await Promise.all([
        holdResponse,
        page.getByRole('button', { name: /update bookings/i }).click(),
      ])

      await expect(page.getByText('Complete Payment', { exact: true })).toBeVisible({
        timeout: 15000,
      })

      // The Membership tab is the only tab rendered (no drop-in, no class pass).
      await expect(page.getByRole('tab', { name: /membership/i })).toBeVisible()

      // ── Core assertions ──────────────────────────────────────────────────────

      // 1. "Use my membership" MUST NOT be offered.
      //    canUseSubscriptionForQuantity=false because userPlanMaxPerTimeslot=1
      //    and the requested quantity is 2.
      await expect(
        page.getByRole('button', { name: /use my membership/i }),
      ).toHaveCount(0)

      // 2. The ineligible cap=1 plan MUST NOT appear as an upgrade option.
      //    It is excluded from eligiblePlansForQuantity by the server.
      await expect(page.getByText(ineligibleOtherPlanName)).not.toBeVisible()

      // 3. The eligible multi-slot upgrade plan MUST appear as an upgrade option.
      await expect(page.getByText(eligibleUpgradePlanName)).toBeVisible({ timeout: 10000 })

      // 4. At least one "Upgrade Subscription" button must be visible (one per
      //    eligible plan — here exactly one: eligibleUpgradePlan).
      await expect(
        page.getByRole('button', { name: /upgrade subscription/i }),
      ).toBeVisible()
    },
  )
})

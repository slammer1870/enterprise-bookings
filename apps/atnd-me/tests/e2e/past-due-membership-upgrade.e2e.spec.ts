import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import {
  createTestBooking,
  createTestClassOption,
  createTestLesson,
  createTestPlan,
  createTestSubscription,
  setClassOptionAllowedPlans,
  updateTenantStripeConnect,
} from './helpers/data-helpers'

test.describe('Past-due membership upgrade flow', () => {
  test('red: past-due member can upgrade after increasing quantity beyond current plan allowance', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_test_upgrade_${tenant.id}`,
    })

    const currentPlan = await createTestPlan({
      tenantId: tenant.id,
      name: `Single Membership Upgrade Test ${workerIndex}`,
      sessions: 8,
      allowMultipleBookingsPerLesson: false,
      stripeProductId: `prod_single_upgrade_${workerIndex}`,
      priceId: `price_single_upgrade_${workerIndex}`,
    })

    const familyPlan = await createTestPlan({
      tenantId: tenant.id,
      name: `Family Membership Upgrade Test ${workerIndex}`,
      sessions: 8,
      allowMultipleBookingsPerLesson: true,
      stripeProductId: `prod_family_upgrade_${workerIndex}`,
      priceId: `price_family_upgrade_${workerIndex}`,
    })

    const classOption = await createTestClassOption(
      tenant.id,
      'Past Due Upgrade Booking Class',
      10,
      undefined,
      workerIndex
    )

    await setClassOptionAllowedPlans(classOption.id, [currentPlan.id, familyPlan.id])

    const startTime = new Date()
    startTime.setHours(9, 0, 0, 0)
    startTime.setDate(startTime.getDate() + 1 + workerIndex)
    const endTime = new Date(startTime)
    endTime.setHours(10, 0, 0, 0)

    const lesson = await createTestLesson(
      tenant.id,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true
    )

    await createTestBooking(user.id, lesson.id, 'confirmed')
    await createTestBooking(user.id, lesson.id, 'pending')
    await createTestBooking(user.id, lesson.id, 'pending')

    await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: currentPlan.id,
      status: 'past_due',
      stripeSubscriptionId: null,
      stripeCustomerId: `cus_upgrade_${workerIndex}`,
      stripeAccountId: `acct_test_upgrade_${tenant.id}`,
    })

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    const managePath = `/bookings/${lesson.id}/manage`
    await navigateToTenant(page, tenant.slug, managePath)
    await page.waitForLoadState('load').catch(() => null)

    await expect(page.getByText('Complete Payment', { exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(/payment methods/i)).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText(/you do not have a plan that allows you to book into this lesson/i)
    ).toBeVisible({ timeout: 10000 })

    const upgradeButton = page.getByRole('button', { name: /upgrade subscription/i })
    await expect(upgradeButton).toBeEnabled()
    await upgradeButton.click()

    await expect(page.getByText(/no subscription found/i)).not.toBeVisible({
      timeout: 5000,
    })

    await page.waitForURL(/test_stripe_portal=upgrade/, { timeout: 10000 })
  })
})

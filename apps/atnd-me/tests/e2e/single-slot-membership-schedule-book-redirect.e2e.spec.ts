/**
 * Regression: schedule "Book" for a single-slot membership-only class must call
 * `bookings.bookSingleSlotTimeslotOrRedirect` with tenant-aware Payload `req` so access
 * control can resolve the tenant (see packages/trpc single-slot shortcut).
 *
 * Without `req`, the mutation returned 403 "You are not allowed to perform this action."
 * and the client never navigated to `/bookings/[id]`.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestPlan,
  setEventTypeAllowedPlans,
  updateTenantStripeConnect,
} from './helpers/data-helpers'
import { uniqueClassName } from '@repo/testing-config/src/playwright'

function addDays(start: Date, days: number): Date {
  const next = new Date(start)
  next.setDate(next.getDate() + days)
  return next
}

async function advanceScheduleToDate(page: Parameters<typeof test>[0]['page'], targetDate: Date) {
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: 15000 })

  const toggle = dateLabel.locator('xpath=..')
  const nextDayButton = toggle.locator('svg').nth(1)
  const targetLabel = targetDate.toDateString()

  for (let i = 0; i < 14; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    await nextDayButton.click()
    await expect(dateLabel).toHaveText(targetLabel, { timeout: 10000 }).catch(() => null)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: 15000 })
}

test.describe('Single-slot membership: schedule Book → booking page', () => {
  test.setTimeout(120_000)

  test('logged-in user without subscription is redirected to booking page (tRPC shortcut succeeds)', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    if (!tenant?.id || !tenant.slug || !user?.email) {
      throw new Error('Expected tenant and user fixtures')
    }

    await updateTenantStripeConnect(tenant.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_single_slot_${workerIndex}`,
    })

    const plan = await createTestPlan({
      tenantId: tenant.id,
      name: `E2E Single Slot Plan ${workerIndex}`,
      sessions: 8,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_single_slot_${workerIndex}`,
      priceId: `price_e2e_single_slot_${workerIndex}`,
    })

    const classNameBase = uniqueClassName(`ATND Single Slot Membership ${tenant.id}`)
    const classOption = await createTestEventType(
      tenant.id,
      classNameBase,
      10,
      'E2E single-slot membership schedule redirect',
      workerIndex
    )
    // `createTestEventType` stores `${name} ${tenantId}${workerIndex ? ' wN' : ''}` (see data-helpers).
    const scheduleTitle = `${classNameBase} ${tenant.id}${workerIndex > 0 ? ` w${workerIndex}` : ''}`

    await setEventTypeAllowedPlans(classOption.id, [plan.id])

    const targetDate = addDays(new Date(), 4 + workerIndex)
    targetDate.setHours(0, 0, 0, 0)

    const startTime = new Date(targetDate)
    startTime.setHours(10, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    const lesson = await createTestTimeslot(tenant.id, classOption.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenant.slug })

    await navigateToTenant(page, tenant.slug, '/')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/home', {
      timeout: 15000,
    }).catch(() => null)

    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 15000 }).catch(() => null)
    await advanceScheduleToDate(page, targetDate)

    await expect(page.getByText('No timeslots scheduled for today')).not.toBeVisible({
      timeout: 5000,
    }).catch(() => null)

    const lessonTitle = page.getByText(scheduleTitle, { exact: true }).first()
    await expect(lessonTitle).toBeVisible({ timeout: 20000 })

    const lessonRow = lessonTitle.locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
    const bookBtn = lessonRow.getByRole('button', { name: /^book$/i })

    const trpcOk = page.waitForResponse(
      (response) =>
        response.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
      { timeout: 20000 }
    )

    await Promise.all([trpcOk, bookBtn.click()])

    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}`, { timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|payment methods|subscription|membership|choose how many slots/i).first(),
    ).toBeVisible({ timeout: 20000 })
  })
})

/**
 * Regression: a tenant admin assigned only to tenant B must be able to book from tenant A's
 * public schedule. Previously `timeslotsRead` scoped reads to the admin's `payload-tenant`
 * cookie (tenant B) or denied when the host tenant was not in their memberships, so
 * `getByIdForBooking` returned NOT_FOUND and `createBookingPage` redirected to `/` → `/home`.
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
import { advanceScheduleToDate } from './helpers/schedule-helpers'

function tenantOrigin(slug: string): string {
  return `http://${slug}.localhost:3000`
}

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function getLessonBookButton(page: Parameters<typeof advanceScheduleToDate>[0], scheduleTitle: string) {
  const lessonTitles = page.getByText(scheduleTitle, { exact: true })
  await expect(lessonTitles.first()).toBeVisible({ timeout: 20000 })

  const count = await lessonTitles.count()
  for (let i = 0; i < count; i++) {
    const lessonRow = lessonTitles.nth(i).locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
    const btn = lessonRow.getByRole('button', { name: /^book$/i })
    if ((await btn.count()) > 0) {
      return btn
    }
  }

  const lessonRow = lessonTitles.first().locator('xpath=ancestor::div[contains(@class,"border-b")]').first()
  return lessonRow.getByRole('button', { name: /^book$/i })
}

test.describe('Tenant admin cross-tenant public schedule booking', () => {
  // Dev-mode schedule compilation + cross-tenant navigation can exceed PW_E2E_FAST caps.
  test.setTimeout(120_000)

  test('tenant B admin can open tenant A booking page from public schedule', async ({
    page,
    testData,
  }) => {
    const tenantA = testData.tenants[0]!
    const tenantB = testData.tenants[1]!
    const tenantAdminB = testData.users.tenantAdmin2
    const w = testData.workerIndex

    if (!tenantA?.id || !tenantA?.slug || !tenantB?.id || !tenantAdminB?.email) {
      throw new Error('Expected tenant A, tenant B, and tenant B admin fixtures')
    }

    await updateTenantStripeConnect(tenantA.id, {
      stripeConnectOnboardingStatus: 'active',
      stripeConnectAccountId: `acct_e2e_ta_cross_${w}`,
    })

    const plan = await createTestPlan({
      tenantId: tenantA.id,
      name: `E2E TA Cross-Tenant Plan ${w}`,
      sessions: 8,
      allowMultipleBookingsPerTimeslot: false,
      stripeProductId: `prod_e2e_ta_cross_${w}`,
      priceId: `price_e2e_ta_cross_${w}`,
    })

    const className = uniqueClassName(`E2E TA Cross-Tenant Booking ${tenantA.id}`)
    const eventType = await createTestEventType(
      tenantA.id,
      className,
      10,
      'Cross-tenant tenant-admin booking regression',
      w,
    )
    const scheduleTitle = `${className} ${tenantA.id}${w > 0 ? ` w${w}` : ''}`

    await setEventTypeAllowedPlans(eventType.id, [plan.id])

    const startTime = futureDate(12 + w)
    const endTime = futureDate(12 + w, 11)
    const lesson = await createTestTimeslot(tenantA.id, eventType.id, startTime, endTime, undefined, true)

    // Authenticated on tenant A's host (simulates visiting another tenant's public site).
    await loginAsRegularUserViaApi(page, tenantAdminB.email, 'password', { tenantSlug: tenantA.slug })

    await navigateToTenant(page, tenantA.slug, '/')
    await page
      .waitForURL((url) => url.pathname === '/' || url.pathname === '/home', { timeout: 15000 })
      .catch(() => null)
    await expect(page.getByText(/loading schedule/i)).not.toBeVisible({ timeout: 30000 }).catch(() => null)

    await advanceScheduleToDate(page, startTime)

    const bookBtn = await getLessonBookButton(page, scheduleTitle)
    await expect(bookBtn).toBeVisible({ timeout: 10000 })

    // Stale admin-panel cookies from tenant B — set right before booking (matches production).
    const originA = tenantOrigin(tenantA.slug)
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenantB.id), url: `${originA}/` },
      { name: 'payload-tenant', value: String(tenantB.id), url: `${originA}/admin/` },
    ])

    const trpcCall = page.waitForResponse(
      (r) =>
        r.url().includes('bookSingleSlotTimeslotOrRedirect') &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 20000 },
    )
    await Promise.all([trpcCall, bookBtn.click()])

    await page.waitForURL((url) => url.pathname === `/bookings/${lesson.id}`, { timeout: 20000 })
    expect(page.url()).not.toMatch(/\/home\/?$/)
    await expect(
      page.getByText(/select quantity|payment methods|subscription|membership|choose how many slots/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })
})

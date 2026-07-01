import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import {
  assertSchedulerDedupeExpectations,
  buildSchedulerWeekDays,
  createSchedulerViaAdminRequest,
  deleteSchedulersForTenant,
  seedSchedulerClearExistingDedupeScenario,
  setPayloadTenantCookies,
  waitForSchedulerGenerationSettled,
} from './helpers/scheduler-e2e-helpers'
import { getPayloadInstance } from './helpers/data-helpers'

async function ensureSidebarOpen(page: import('@playwright/test').Page) {
  const tenantSelector = page.getByTestId('tenant-selector')
  if (await tenantSelector.isVisible().catch(() => false)) return

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
    await page.waitForTimeout(250)
  }

  await tenantSelector.waitFor({ state: 'visible', timeout: 20_000 })
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function openTimeslotsDashboardForDate(page: import('@playwright/test').Page, targetDate: Date) {
  // Navigate with the date filter pre-applied in the query string.
  //
  // If we navigate to /admin/collections/timeslots with NO query params, the
  // DatePicker component mounts with selectedDateISO=undefined and immediately
  // calls router.replace() inside startTransition to redirect to today's date.
  // While that server-side navigation is pending, isPending=true and the
  // DayPicker renders with disabled={true} — ALL calendar day buttons are
  // disabled. In CI the server re-render can take several seconds, causing the
  // subsequent click to time out even though the button is visible.
  //
  // By pre-loading the date filter in the URL, selectedDateISO is set on first
  // render so the redirect effect never fires, isPending stays false, and every
  // calendar day button is immediately clickable.
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)
  const gte = startOfDay.toISOString()
  const lte = endOfDay.toISOString()
  // Matches the format produced by getTimeslotsQuery (qs.stringify, encode: false)
  // and parsed by getTimeslotStartTimeFilter (where.or[0].and[0].startTime.gte).
  const preloadedQuery = `depth=0&limit=100&sort=startTime&where[or][0][and][0][startTime][greater_than_equal]=${gte}&where[or][0][and][1][startTime][less_than_equal]=${lte}`

  await page.goto(`/admin/collections/timeslots?${preloadedQuery}`, {
    waitUntil: 'domcontentloaded',
    timeout: process.env.CI ? 120_000 : 60_000,
  })
  await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
    timeout: process.env.CI ? 120_000 : 60_000,
  })

  const calendar = page.locator('[data-slot="calendar"]').first()
  await expect(calendar).toBeVisible({ timeout: process.env.CI ? 120_000 : 60_000 })

  const targetMonthLabel = targetDate.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const nextMonthButton = page.getByRole('button', { name: /go to the next month/i })
  const prevMonthButton = page.getByRole('button', { name: /go to the previous month/i })

  // The calendar initialises to the month of targetDate when selectedDateISO is
  // pre-loaded, but navigate if needed (safety net for edge cases).
  const now = new Date()
  const targetIsBeforeNow = targetDate < now
  for (let i = 0; i < 24; i += 1) {
    const monthCaption = calendar.getByText(targetMonthLabel, { exact: true })
    if (await monthCaption.isVisible().catch(() => false)) break
    if (targetIsBeforeNow) {
      await prevMonthButton.click()
    } else {
      await nextMonthButton.click()
    }
  }

  await expect(calendar.getByText(targetMonthLabel, { exact: true })).toBeVisible({
    timeout: process.env.CI ? 120_000 : 60_000,
  })

  const ymd = formatLocalYmd(targetDate)
  const dayButton = calendar.locator(`button[data-day="${ymd}"]`)
  await expect(dayButton).toBeVisible({ timeout: process.env.CI ? 120_000 : 60_000 })
  // Wait for the button to be enabled before clicking. The first-effect in
  // DatePicker adds depth=0 if missing; if it fires it briefly sets isPending.
  await expect(dayButton).toBeEnabled({ timeout: process.env.CI ? 30_000 : 15_000 })
  await dayButton.click()
}

test.describe('Scheduler clearExisting dedupe', () => {
  test.setTimeout(e2eSlowTestTimeout(240_000, 180_000))

  test('preserves booked overlapping timeslots and skips duplicate generation', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[2]
    const location = testData.tenant3Location
    const bookingUser = testData.users.userSingleBranch

    if (!tenant?.id || !location?.id || !bookingUser?.id) {
      throw new Error('Expected tenant3, single branch location, and booking user fixtures')
    }

    await deleteSchedulersForTenant(Number(tenant.id))

    const seed = await seedSchedulerClearExistingDedupeScenario({
      tenantId: Number(tenant.id),
      branchId: location.id,
      bookingUserId: Number(bookingUser.id),
      workerIndex: testData.workerIndex,
    })

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await setPayloadTenantCookies(page, Number(tenant.id))
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await page.goto('/admin/collections/scheduler/create', {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    // The create page breadcrumb shows "Creating new Scheduler"; use that as a
    // reliable page-load guard instead of the h1 which renders as "[Untitled]"
    // until the user sets a title-bearing field.
    await expect(page.getByText('Creating new Scheduler').first()).toBeVisible({
      timeout: process.env.CI ? 120_000 : 60_000,
    })

    const weekDays = buildSchedulerWeekDays({
      eventTypeId: seed.eventTypeId,
      mondayStartIso: seed.mondayTemplateStart,
      mondayEndIso: seed.mondayTemplateEnd,
      wednesdayStartIso: seed.wednesdayTemplateStart,
      wednesdayEndIso: seed.wednesdayTemplateEnd,
    })

    // Payload nested week arrays are brittle in Playwright; submit the schedule through the
    // authenticated admin API while the create form captures the admin's tenant context.
    const schedulerId = await createSchedulerViaAdminRequest(page, {
      email: testData.users.superAdmin.email,
      password: 'password',
      tenantId: seed.tenantId,
      branchId: seed.branchId,
      startDate: seed.startDate,
      endDate: seed.endDate,
      eventTypeId: seed.eventTypeId,
      clearExisting: true,
      weekDays,
    })

    await page.goto(`/admin/collections/scheduler/${schedulerId}`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await expect(page).toHaveURL(new RegExp(`/admin/collections/scheduler/${schedulerId}`))

    await waitForSchedulerGenerationSettled()
    await assertSchedulerDedupeExpectations({ seed })

    // Use a future booked timeslot for the calendar UI check — the calendar widget
    // disables past-date buttons so clicking them would time out.
    const sampleBookedId = seed.futureBookedTimeslotIds[0]
    if (sampleBookedId == null) throw new Error('Expected at least one future booked timeslot in seed data')

    const payload = await getPayloadInstance()
    const sampleBookedTimeslot = await payload.findByID({
      collection: 'timeslots',
      id: sampleBookedId,
      depth: 0,
      overrideAccess: true,
    })
    const sampleDate = new Date(String(sampleBookedTimeslot.startTime))

    await openTimeslotsDashboardForDate(page, sampleDate)

    const bookedRow = page.getByRole('row').filter({ hasText: seed.eventTypeName }).first()
    await expect(bookedRow).toBeVisible({ timeout: process.env.CI ? 60_000 : 30_000 })
    await expect(bookedRow.getByRole('button', { name: '1', exact: true })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 30_000,
    })
  })
})

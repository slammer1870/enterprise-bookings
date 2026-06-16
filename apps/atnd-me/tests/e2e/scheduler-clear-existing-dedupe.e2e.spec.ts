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
  await page.goto('/admin/collections/timeslots', {
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

  for (let i = 0; i < 12; i += 1) {
    const monthCaption = calendar.getByText(targetMonthLabel, { exact: true })
    if (await monthCaption.isVisible().catch(() => false)) break
    await nextMonthButton.click()
  }

  await expect(calendar.getByText(targetMonthLabel, { exact: true })).toBeVisible({
    timeout: process.env.CI ? 120_000 : 60_000,
  })

  const ymd = formatLocalYmd(targetDate)
  const dayButton = calendar.locator(`button[data-day="${ymd}"]`)
  await expect(dayButton).toBeVisible({ timeout: process.env.CI ? 120_000 : 60_000 })
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
    await expect(page.getByRole('heading', { name: /scheduler/i }).first()).toBeVisible({
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

    const sampleBookedId = seed.bookedTimeslotIds[0]
    if (sampleBookedId == null) throw new Error('Expected at least one booked timeslot in seed data')

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

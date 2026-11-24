import { formatInTimeZone } from '@repo/shared-utils'

import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import { createTestEventType, getPayloadInstance } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import {
  addTimeSlotToSchedulerDay,
  createSchedulerWithEmptyWeek,
  deleteSchedulersForTenant,
  fillSchedulerTimeSlotTimes,
  findTenantTimeslotsInRange,
  getSchedulerDayBlock,
  saveSchedulerAndWait,
  setPayloadTenantCookies,
  waitForSchedulerGenerationSettled,
} from './helpers/scheduler-e2e-helpers'

const TENANT_TIME_ZONE = 'Europe/Dublin'
/** One hour ahead of the tenant all year. */
const BROWSER_TIME_ZONE = 'Europe/Rome'

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

test.describe('Scheduler slot times entered from another time zone', () => {
  test.use({ timezoneId: BROWSER_TIME_ZONE })
  test.setTimeout(e2eSlowTestTimeout(300_000, 240_000))

  test('a 4pm slot entered from Italy is a 4pm slot at the Dublin tenant', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[2]
    const location = testData.tenant3Location

    if (!tenant?.id || !location?.id) {
      throw new Error('Expected tenant3 and single branch location fixtures')
    }

    const payload = await getPayloadInstance()
    const tenantDoc = await payload.findByID({
      collection: 'tenants',
      id: tenant.id,
      depth: 0,
      overrideAccess: true,
    })
    expect((tenantDoc as { timeZone?: string | null }).timeZone).toBe(TENANT_TIME_ZONE)

    const browserTimeZone = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    expect(browserTimeZone).toBe(BROWSER_TIME_ZONE)

    await deleteSchedulersForTenant(Number(tenant.id))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 1)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 13)
    endDate.setHours(23, 59, 59, 999)

    const eventType = await createTestEventType(
      Number(tenant.id),
      `E2E Scheduler Browser TZ ${Date.now()}-w${testData.workerIndex}`,
      10,
      'Scheduler browser time zone regression',
      testData.workerIndex,
    )

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await setPayloadTenantCookies(page, Number(tenant.id))
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const schedulerId = await createSchedulerWithEmptyWeek(page, {
      email: testData.users.superAdmin.email,
      password: 'password',
      tenantId: Number(tenant.id),
      branchId: location.id,
      startDate,
      endDate,
      eventTypeId: Number(eventType.id),
    })
    await waitForSchedulerGenerationSettled({ payload })

    await page.goto(`/admin/collections/scheduler/${schedulerId}`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await expect(page.getByRole('heading', { name: 'Days', exact: true })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 30_000,
    })

    const dayName = 'Tuesday'
    const dayDbIndex = 1

    await addTimeSlotToSchedulerDay(page, dayName)
    await fillSchedulerTimeSlotTimes(page, dayName, 0, {
      startLabels: ['4:00 PM'],
      endLabels: ['5:00 PM'],
    })

    const dayBlock = await getSchedulerDayBlock(page, dayName)
    const startInput = dayBlock.locator(
      'xpath=.//*[contains(text(),"Start Time")]/following::input[1]',
    )
    const endInput = dayBlock.locator('xpath=.//*[contains(text(),"End Time")]/following::input[1]')
    await expect(startInput).toHaveValue('4:00 PM')
    await expect(endInput).toHaveValue('5:00 PM')

    await saveSchedulerAndWait(page, schedulerId)
    await waitForSchedulerGenerationSettled({ payload })

    // The template stores the slot as the tenant's wall-clock time.
    const scheduler = await payload.findByID({
      collection: 'scheduler',
      id: schedulerId,
      depth: 0,
      overrideAccess: true,
    })
    const savedSlot = (
      scheduler as {
        week?: { days?: Array<{ timeSlot?: Array<{ startTime: string; endTime: string }> }> }
      }
    ).week?.days?.[dayDbIndex]?.timeSlot?.[0]
    expect(savedSlot).toBeDefined()
    expect(formatInTimeZone(savedSlot!.startTime, 'HH:mm', TENANT_TIME_ZONE)).toBe('16:00')
    expect(formatInTimeZone(savedSlot!.endTime, 'HH:mm', TENANT_TIME_ZONE)).toBe('17:00')

    // Every generated timeslot runs 4pm–5pm at the tenant.
    const timeslots = await findTenantTimeslotsInRange({
      tenantId: Number(tenant.id),
      branchId: location.id,
      startDate,
      endDate,
    })
    expect(timeslots.length).toBeGreaterThan(0)
    for (const timeslot of timeslots) {
      expect(formatInTimeZone(timeslot.startTime, 'EEEE HH:mm', TENANT_TIME_ZONE)).toBe(
        'Tuesday 16:00',
      )
      expect(formatInTimeZone(timeslot.endTime, 'HH:mm', TENANT_TIME_ZONE)).toBe('17:00')
    }

    // The form still reads 4pm–5pm after a reload.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Days', exact: true })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 30_000,
    })
    const reloadedDayBlock = await getSchedulerDayBlock(page, dayName)
    await expect(
      reloadedDayBlock.locator('xpath=.//*[contains(text(),"Start Time")]/following::input[1]'),
    ).toHaveValue('4:00 PM')
    await expect(
      reloadedDayBlock.locator('xpath=.//*[contains(text(),"End Time")]/following::input[1]'),
    ).toHaveValue('5:00 PM')
  })
})

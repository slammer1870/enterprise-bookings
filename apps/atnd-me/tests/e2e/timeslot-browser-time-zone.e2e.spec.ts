import { TZDate } from '@date-fns/tz'
import { formatInTimeZone } from '@repo/shared-utils'
import {
  saveTimeslot,
  selectEventTypeInTimeslotForm,
  setTimeslotDateAndTime,
} from '@repo/testing-config/src/playwright'

import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import { setPayloadTenantCookies } from './helpers/scheduler-e2e-helpers'

const TENANT_TIME_ZONE = 'Europe/Dublin'
/** Eight hours behind the tenant in November — exposes the date-picker day shift. */
const BROWSER_TIME_ZONE = 'America/Los_Angeles'

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

/** Wait until tenant date/time fields finished loading their zone (shimmer gone). */
async function waitForTenantDateTimeInputs(page: import('@playwright/test').Page) {
  await expect(page.locator('#field-date').getByRole('textbox')).toBeVisible({
    timeout: process.env.CI ? 60_000 : 30_000,
  })
  await expect(page.locator('#field-startTime').getByRole('textbox')).toBeVisible({
    timeout: process.env.CI ? 60_000 : 30_000,
  })
  await expect(page.locator('#field-endTime').getByRole('textbox')).toBeVisible({
    timeout: process.env.CI ? 60_000 : 30_000,
  })
}

test.describe('Timeslot form entered from another time zone', () => {
  test.use({ timezoneId: BROWSER_TIME_ZONE })
  test.setTimeout(e2eSlowTestTimeout(300_000, 240_000))

  test('date and times mean that day and clock at the Dublin tenant', async ({
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

    const eventType = await createTestEventType(
      Number(tenant.id),
      `E2E Timeslot Browser TZ ${Date.now()}-w${testData.workerIndex}`,
      10,
      'Timeslot browser time zone regression',
      testData.workerIndex,
    )

    // Same shape as generation: date is midnight at the tenant.
    const tenantDate = new TZDate(2026, 10, 20, 0, 0, 0, 0, TENANT_TIME_ZONE)
    const seedStart = new TZDate(2026, 10, 20, 10, 0, 0, 0, TENANT_TIME_ZONE)
    const seedEnd = new TZDate(2026, 10, 20, 11, 0, 0, 0, TENANT_TIME_ZONE)

    const timeslot = await createTestTimeslot(
      Number(tenant.id),
      Number(eventType.id),
      new Date(seedStart.getTime()),
      new Date(seedEnd.getTime()),
      undefined,
      true,
      location.id,
    )

    // Force the generator-style midnight storage (createTestTimeslot may keep a date-only string).
    await payload.update({
      collection: 'timeslots',
      id: timeslot.id,
      data: {
        date: new Date(tenantDate.getTime()).toISOString(),
        startTime: new Date(seedStart.getTime()).toISOString(),
        endTime: new Date(seedEnd.getTime()).toISOString(),
      },
      overrideAccess: true,
    })

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await setPayloadTenantCookies(page, Number(tenant.id))
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await page.goto(`/admin/collections/timeslots/${timeslot.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await waitForTenantDateTimeInputs(page)

    // Without TenantDateField, LA would show 19/11/2026 for Dublin midnight on the 20th.
    await expect(page.locator('#field-date').getByRole('textbox')).toHaveValue('20/11/2026')

    await setTimeslotDateAndTime(page, new Date(2026, 10, 20), {
      startLabels: ['4:00 PM'],
      endLabels: ['5:00 PM'],
    })
    await expect(page.locator('#field-startTime').getByRole('textbox')).toHaveValue('4:00 PM')
    await expect(page.locator('#field-endTime').getByRole('textbox')).toHaveValue('5:00 PM')

    await saveTimeslot(page)
    await waitForTenantDateTimeInputs(page)

    const saved = await payload.findByID({
      collection: 'timeslots',
      id: timeslot.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(formatInTimeZone(String(saved.date), 'yyyy-MM-dd', TENANT_TIME_ZONE)).toBe('2026-11-20')
    expect(formatInTimeZone(String(saved.startTime), 'HH:mm', TENANT_TIME_ZONE)).toBe('16:00')
    expect(formatInTimeZone(String(saved.endTime), 'HH:mm', TENANT_TIME_ZONE)).toBe('17:00')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForTenantDateTimeInputs(page)
    await expect(page.locator('#field-date').getByRole('textbox')).toHaveValue('20/11/2026')
    await expect(page.locator('#field-startTime').getByRole('textbox')).toHaveValue('4:00 PM')
    await expect(page.locator('#field-endTime').getByRole('textbox')).toHaveValue('5:00 PM')
  })

  test('creating a timeslot from Los Angeles keeps the picked day and 4pm at Dublin', async ({
    page,
    request,
    testData,
  }) => {
    const tenant = testData.tenants[2]
    const location = testData.tenant3Location

    if (!tenant?.id || !location?.id) {
      throw new Error('Expected tenant3 and single branch location fixtures')
    }

    const eventType = await createTestEventType(
      Number(tenant.id),
      `E2E Timeslot Create TZ ${Date.now()}-w${testData.workerIndex}`,
      10,
      'Timeslot create browser time zone regression',
      testData.workerIndex,
    )

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await setPayloadTenantCookies(page, Number(tenant.id))
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await page.goto('/admin/collections/timeslots/create', {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await waitForTenantDateTimeInputs(page)

    await selectEventTypeInTimeslotForm(page, eventType.name)
    const targetDate = new Date(2026, 10, 25)
    await setTimeslotDateAndTime(page, targetDate, {
      startLabels: ['4:00 PM'],
      endLabels: ['5:00 PM'],
    })

    await saveTimeslot(page)
    await waitForTenantDateTimeInputs(page)

    const idMatch = page.url().match(/\/timeslots\/(\d+)/)
    expect(idMatch?.[1]).toBeTruthy()
    const timeslotId = Number(idMatch![1])

    const payload = await getPayloadInstance()
    const saved = await payload.findByID({
      collection: 'timeslots',
      id: timeslotId,
      depth: 0,
      overrideAccess: true,
    })
    expect(formatInTimeZone(String(saved.date), 'yyyy-MM-dd', TENANT_TIME_ZONE)).toBe('2026-11-25')
    expect(formatInTimeZone(String(saved.startTime), 'HH:mm', TENANT_TIME_ZONE)).toBe('16:00')
    expect(formatInTimeZone(String(saved.endTime), 'HH:mm', TENANT_TIME_ZONE)).toBe('17:00')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForTenantDateTimeInputs(page)
    await expect(page.locator('#field-date').getByRole('textbox')).toHaveValue('25/11/2026')
    await expect(page.locator('#field-startTime').getByRole('textbox')).toHaveValue('4:00 PM')
    await expect(page.locator('#field-endTime').getByRole('textbox')).toHaveValue('5:00 PM')
  })
})

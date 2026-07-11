import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import { createTestEventType } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import {
  countTimeSlotRowsInDayUI,
  createSchedulerWithMondaySlot,
  deleteSchedulersForTenant,
  getSchedulerTimeSlotCountFromDB,
  saveSchedulerAndWait,
  setPayloadTenantCookies,
} from './helpers/scheduler-e2e-helpers'

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

function scheduleTemplateIso(referenceDay: Date, hour: number, minute: number): string {
  const base = new Date(referenceDay)
  base.setHours(0, 0, 0, 0)
  return new Date(base.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000).toISOString()
}

test.describe('Scheduler save empty timeslots regression', () => {
  test.setTimeout(e2eSlowTestTimeout(240_000, 180_000))

  test('does not add phantom empty timeSlot rows after save', async ({ page, request, testData }) => {
    const tenant = testData.tenants[2]
    const location = testData.tenant3Location

    if (!tenant?.id || !location?.id) {
      throw new Error('Expected tenant3 and single branch location fixtures')
    }

    await deleteSchedulersForTenant(Number(tenant.id))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 1)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 13)
    endDate.setHours(23, 59, 59, 999)

    const eventType = await createTestEventType(
      Number(tenant.id),
      `E2E Scheduler Save Empty ${Date.now()}-w${testData.workerIndex}`,
      10,
      'Scheduler save empty timeslots regression',
      testData.workerIndex,
    )

    const mondayStartIso = scheduleTemplateIso(startDate, 10, 0)
    const mondayEndIso = scheduleTemplateIso(startDate, 11, 0)

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await setPayloadTenantCookies(page, Number(tenant.id))
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const schedulerId = await createSchedulerWithMondaySlot(page, {
      email: testData.users.superAdmin.email,
      password: 'password',
      tenantId: Number(tenant.id),
      branchId: location.id,
      startDate,
      endDate,
      eventTypeId: Number(eventType.id),
      mondayStartIso,
      mondayEndIso,
    })

    await page.goto(`/admin/collections/scheduler/${schedulerId}`, {
      waitUntil: 'domcontentloaded',
      timeout: process.env.CI ? 120_000 : 60_000,
    })
    await expect(page).toHaveURL(new RegExp(`/admin/collections/scheduler/${schedulerId}`))
    await expect(page.getByRole('heading', { name: 'Days', exact: true })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 30_000,
    })

    const mondayDbIndex = 0
    const emptyDayName = 'Tuesday'
    const emptyDayDbIndex = 1

    const mondayDbCount = await getSchedulerTimeSlotCountFromDB(schedulerId, mondayDbIndex)
    expect(mondayDbCount).toBe(1)

    const emptyDayDbCount = await getSchedulerTimeSlotCountFromDB(schedulerId, emptyDayDbIndex)
    expect(emptyDayDbCount).toBe(0)

    const baselineEmptyDayUiCount = await countTimeSlotRowsInDayUI(page, emptyDayName)

    await saveSchedulerAndWait(page, schedulerId)

    // Allow afterChange + generation job kickoff to complete.
    await page.waitForTimeout(3000)

    const uiCountAfterSave = await countTimeSlotRowsInDayUI(page, emptyDayName)
    expect(uiCountAfterSave).toBe(baselineEmptyDayUiCount)

    const dbCountAfterSave = await getSchedulerTimeSlotCountFromDB(schedulerId, emptyDayDbIndex)
    expect(dbCountAfterSave).toBe(0)

    if (uiCountAfterSave > baselineEmptyDayUiCount) {
      const removeButtons = page
        .getByText(emptyDayName, { exact: true })
        .locator('xpath=ancestor::*[count(.//*[@role="listitem"]) > 0][1]')
        .getByRole('button', { name: /^Remove$/i })
      const removeCount = await removeButtons.count()
      for (let i = removeCount - 1; i >= 0; i -= 1) {
        await removeButtons.nth(i).click()
        await page.waitForTimeout(300)
      }
      await page.waitForTimeout(1000)
      const uiCountAfterRemove = await countTimeSlotRowsInDayUI(page, emptyDayName)
      expect(uiCountAfterRemove).toBe(baselineEmptyDayUiCount)
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Days', exact: true })).toBeVisible({
      timeout: process.env.CI ? 60_000 : 30_000,
    })
    const uiCountAfterReload = await countTimeSlotRowsInDayUI(page, emptyDayName)
    expect(uiCountAfterReload).toBe(baselineEmptyDayUiCount)
  })
})

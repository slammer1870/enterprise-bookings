import { expect, type Page } from '@playwright/test'
import { e2eExpectTimeout, isE2EFast } from './timeouts'
import { getPayloadInstance } from './data-helpers'

function calendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((calendarDay(to).getTime() - calendarDay(from).getTime()) / msPerDay)
}

/** Advance the public schedule date picker to `targetDate` (calendar day). */
export async function advanceScheduleToDate(page: Page, targetDate: Date): Promise<void> {
  const dateLabel = page.locator('p.text-center.text-lg').first()
  await expect(dateLabel).toBeVisible({ timeout: e2eExpectTimeout(20000) })

  const scheduleToggle = dateLabel.locator('xpath=..')
  const nextDayButton = scheduleToggle.locator('svg').nth(1)
  await expect(nextDayButton).toBeVisible({ timeout: e2eExpectTimeout(5000) })

  const targetLabel = targetDate.toDateString()
  const initialLabel = (await dateLabel.textContent())?.trim()
  if (initialLabel === targetLabel) return

  const fromDate = initialLabel ? new Date(initialLabel) : new Date()
  const stepsNeeded = Math.abs(daysBetween(fromDate, targetDate))
  const maxSteps = Math.min(Math.max(stepsNeeded + 3, 10), 45)
  const clickPauseMs = isE2EFast ? 100 : 200

  for (let i = 0; i < maxSteps; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    await nextDayButton.click({ force: true })
    await page.waitForTimeout(clickPauseMs)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: e2eExpectTimeout(15000) })
}

type Tenant1BranchFixtures = {
  tenants: { id: number }[]
  tenant1Locations: { north: { id: number }; south: { id: number } }
}

/** First alphabetical active branch on tenant1 — matches the public schedule picker default. */
export function tenant1DefaultBranchId(testData: {
  tenant1Locations: { north: { id: number } }
}): number {
  return testData.tenant1Locations.north.id
}

/**
 * Keep only the north/south fixture branches active on tenant1.
 * Other specs can leave extra active locations that change the picker default.
 */
export async function ensureTenant1ActiveBranchesOnly(testData: Tenant1BranchFixtures): Promise<void> {
  const tenant = testData.tenants[0]
  const { north, south } = testData.tenant1Locations
  if (!tenant?.id) return

  const keepIds = [north?.id, south?.id].filter((id): id is number => id != null)
  if (keepIds.length === 0) return

  const payload = await getPayloadInstance()
  await payload.update({
    collection: 'locations',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { active: { equals: true } },
        { id: { not_in: keepIds } },
      ],
    },
    data: { active: false },
    overrideAccess: true,
  })
  await Promise.all(
    keepIds.map((id) =>
      payload.update({ collection: 'locations', id, data: { active: true }, overrideAccess: true }),
    ),
  )
}

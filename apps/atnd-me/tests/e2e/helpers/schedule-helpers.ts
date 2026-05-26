import { expect, type Page } from '@playwright/test'
import { e2eExpectTimeout, isE2EFast } from './timeouts'

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

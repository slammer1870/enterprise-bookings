import { expect, type Page } from '@playwright/test'
import { e2eExpectTimeout, isE2EFast } from './timeouts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function calendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Parse labels from `Date.prototype.toDateString()` (e.g. "Sat Aug 01 2026"). */
function parseDateLabel(label: string): Date | null {
  const parts = label.trim().split(/\s+/)
  if (parts.length !== 4) return null

  const monthIdx = MONTHS.indexOf(parts[1]!)
  if (monthIdx === -1) return null

  const day = Number(parts[2])
  const year = Number(parts[3])
  if (!Number.isFinite(day) || !Number.isFinite(year)) return null

  return new Date(year, monthIdx, day)
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((calendarDay(to).getTime() - calendarDay(from).getTime()) / msPerDay)
}

async function resolveScheduleDateLabel(page: Page) {
  const scheduleScoped = page.locator('#schedule p.text-center.text-lg').first()
  if (await scheduleScoped.isVisible().catch(() => false)) {
    return scheduleScoped
  }

  const headingScoped = page
    .getByRole('heading', { name: /^schedule$/i })
    .locator(
      'xpath=ancestor-or-self::*[.//p[contains(@class,"text-center") and contains(@class,"text-lg")]][1]//p[contains(@class,"text-center") and contains(@class,"text-lg")]',
    )
    .first()

  if (await headingScoped.isVisible().catch(() => false)) {
    return headingScoped
  }

  return page.locator('p.text-center.text-lg').first()
}

/** Advance the public schedule date picker to `targetDate` (calendar day). */
export async function advanceScheduleToDate(page: Page, targetDate: Date): Promise<void> {
  const dateLabel = await resolveScheduleDateLabel(page)
  await expect(dateLabel).toBeVisible({ timeout: e2eExpectTimeout(20000) })

  const scheduleToggle = dateLabel.locator('xpath=..')
  const prevDayButton = scheduleToggle.locator('svg').first()
  const nextDayButton = scheduleToggle.locator('svg').nth(1)
  await expect(nextDayButton).toBeVisible({ timeout: e2eExpectTimeout(5000) })

  const targetLabel = targetDate.toDateString()
  const initialLabel = (await dateLabel.textContent())?.trim()
  if (initialLabel === targetLabel) return

  const fromDate = initialLabel ? parseDateLabel(initialLabel) : null
  const stepsNeeded =
    fromDate != null ? Math.abs(daysBetween(fromDate, targetDate)) : Math.abs(daysBetween(new Date(), targetDate))
  const maxSteps = Math.min(Math.max(stepsNeeded + 5, 15), 120)
  const clickPauseMs = isE2EFast ? 150 : 250

  for (let i = 0; i < maxSteps; i += 1) {
    const currentLabel = (await dateLabel.textContent())?.trim()
    if (currentLabel === targetLabel) return

    const currentDate = currentLabel ? parseDateLabel(currentLabel) : null
    const diff =
      currentDate != null ? daysBetween(currentDate, targetDate) : daysBetween(new Date(), targetDate)
    const button = diff >= 0 ? nextDayButton : prevDayButton

    await button.click({ force: true })
    await page.waitForTimeout(clickPauseMs)
  }

  await expect(dateLabel).toHaveText(targetLabel, { timeout: e2eExpectTimeout(20000) })
}

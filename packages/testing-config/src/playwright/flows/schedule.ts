import { expect as pwExpect, type Page } from '@playwright/test'

const expect: any = pwExpect

/**
 * On the public Schedule, move the ToggleDate component to tomorrow.
 * Returns the Date instance for tomorrow based on the currently displayed date.
 */
export async function goToTomorrowInSchedule(page: Page): Promise<Date> {
  const p: any = page as any
  const dateText = await p.locator('#schedule p').first().innerText()
  const current = new Date(dateText)
  const tomorrow = new Date(current)
  tomorrow.setDate(current.getDate() + 1)
  const tomorrowText = tomorrow.toDateString()

  const rightArrow = p.locator('#schedule svg').nth(1)
  for (let i = 0; i < 5; i++) {
    if ((await p.locator('#schedule p', { hasText: tomorrowText }).count()) > 0) break
    await rightArrow.click()
  }

  await expect(p.locator('#schedule p', { hasText: tomorrowText })).toBeVisible({ timeout: 60000 })
  return tomorrow
}



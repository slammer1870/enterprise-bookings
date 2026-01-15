import { expect as pwExpect, type Page } from '@playwright/test'

const expect: any = pwExpect

/**
 * On the public Schedule, move the ToggleDate component to tomorrow.
 * Returns the Date instance for tomorrow based on the currently displayed date.
 */
export async function goToTomorrowInSchedule(page: Page): Promise<Date> {
  const p: any = page as any
  // Wait until the schedule renders a parseable date.
  const getCurrentDateFromUI = async (): Promise<Date> => {
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      const texts: string[] = await p
        .locator('#schedule p')
        .allInnerTexts()
        .catch(() => [])

      for (const t of texts) {
        const trimmed = (t || '').trim()
        if (!trimmed) continue
        const d = new Date(trimmed)
        if (!Number.isNaN(d.getTime())) return d
      }

      await p.waitForTimeout(250)
    }
    throw new Error('Schedule date did not render in time')
  }

  const current = await getCurrentDateFromUI()
  const tomorrow = new Date(current)
  tomorrow.setDate(current.getDate() + 1)
  const tomorrowText = tomorrow.toDateString()

  const rightArrow = p.locator('#schedule svg').nth(1)
  for (let i = 0; i < 10; i++) {
    if ((await p.locator('#schedule p', { hasText: tomorrowText }).count()) > 0) break
    await rightArrow.click()
    await p.waitForTimeout(200)
  }

  await expect(p.locator('#schedule p', { hasText: tomorrowText }).first()).toBeVisible({
    timeout: 60000,
  })
  return tomorrow
}



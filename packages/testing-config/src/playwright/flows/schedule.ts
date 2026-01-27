import { expect as pwExpect, type Page } from '@playwright/test'

const expect: any = pwExpect

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * On the public Schedule, move the ToggleDate component to tomorrow.
 * Returns the Date instance for tomorrow based on the currently displayed date.
 */
export async function goToTomorrowInSchedule(page: Page): Promise<Date> {
  const p: any = page as any
  const dateLabel = p.locator('#schedule p.text-lg').first()

  // Wait until the schedule renders a parseable date label.
  const getCurrentDateFromUI = async (): Promise<Date> => {
    await expect(dateLabel).toBeVisible({ timeout: 60000 })

    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      const text = ((await dateLabel.innerText().catch(() => '')) || '').trim()
      if (text) {
        const d = new Date(text)
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

  // Right arrow is the sibling immediately after the date <p> in ToggleDate.
  // Don't rely on path#Polygon_3 — it can be stripped or duplicated in builds.
  const rightArrow = p.locator('#schedule p.text-lg + svg')
  await expect(rightArrow).toBeVisible({ timeout: 10000 })

  for (let i = 0; i < 10; i++) {
    const labelText = ((await dateLabel.innerText().catch(() => '')) || '').trim()
    if (labelText.includes(tomorrowText)) break

    await rightArrow.click({ force: true })
    await p.waitForTimeout(400)
    // Wait for the label to change before re-checking
    await dateLabel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  }

  // Verify tomorrow's date is now visible
  await expect(dateLabel).toHaveText(new RegExp(escapeRegExp(tomorrowText)), {
    timeout: 60000,
  })

  // Wait for lessons to finish loading after date change
  // The schedule component uses React Query which shows a loading spinner while fetching
  // We need to wait for the query to complete and the UI to update
  
  // Wait for loading spinner to disappear (if it exists)
  const loadingSpinner = p.locator('#schedule').getByText('Loading schedule...')
  const hasLoadingText = await loadingSpinner.count().catch(() => 0) > 0
  if (hasLoadingText) {
    await expect(loadingSpinner).not.toBeVisible({ timeout: 30000 })
  }

  // Also check for the animated spinner icon (Loader2 component)
  const loaderIcon = p.locator('#schedule').locator('svg').filter({ has: p.locator('[class*="animate-spin"]') })
  const hasLoaderIcon = await loaderIcon.count().catch(() => 0) > 0
  if (hasLoaderIcon) {
    await expect(loaderIcon).not.toBeVisible({ timeout: 30000 })
  }

  // Wait a bit more for React to finish rendering the lesson list
  // This ensures the DOM has fully updated with lesson buttons
  await p.waitForTimeout(1000)

  return tomorrow
}



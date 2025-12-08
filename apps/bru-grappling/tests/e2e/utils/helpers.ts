import { Page, expect } from '@playwright/test'

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page, url?: string) {
  if (url) {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
    // Ignore timeout, page might have background requests
  })
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true })
}

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForVisible(page: Page, selector: string, timeout = 10000) {
  await expect(page.locator(selector).first()).toBeVisible({ timeout })
}

/**
 * Fill form field safely
 */
export async function fillField(page: Page, selector: string, value: string) {
  const field = page.locator(selector).first()
  await expect(field).toBeVisible({ timeout: 10000 })
  await field.fill(value)
}

/**
 * Click button safely
 */
export async function clickButton(page: Page, selector: string | { text: string }) {
  const button = typeof selector === 'string' 
    ? page.locator(selector).first()
    : page.getByRole('button', { name: selector.text }).first()
  
  await expect(button).toBeVisible({ timeout: 10000 })
  await button.click()
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, urlPattern: RegExp | string, timeout = 15000) {
  const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern
  await page.waitForURL(pattern, { timeout })
}

/**
 * Check if element exists
 * Note: selector should be a valid CSS selector or Playwright locator string
 * For text matching, use page.locator('text=/pattern/') instead
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    // If selector contains text pattern (text=/.../), it's not valid CSS
    // Split by comma and handle each part separately
    if (selector.includes('text=/')) {
      // Split selector into parts
      const parts = selector.split(',').map(s => s.trim())
      for (const part of parts) {
        if (part.startsWith('text=')) {
          // This is a text locator
          const count = await page.locator(part).count()
          if (count > 0) return true
        } else {
          // This is a CSS selector
          const count = await page.locator(part).count()
          if (count > 0) return true
        }
      }
      return false
    } else {
      // Valid CSS selector
      const count = await page.locator(selector).count()
      return count > 0
    }
  } catch (e) {
    // If selector is invalid, return false
    return false
  }
}

/**
 * Get text content safely
 */
export async function getText(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first()
  await expect(element).toBeVisible({ timeout: 10000 })
  return await element.textContent() || ''
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page: Page, urlPattern: RegExp | string) {
  const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern
  await page.waitForResponse(response => {
    return pattern.test(response.url())
  }, { timeout: 30000 })
}

/**
 * Navigate schedule to next day
 * Handles the fixed navigation bar that may intercept clicks
 */
export async function navigateScheduleNextDay(page: Page) {
  // Wait for schedule to load
  await page.waitForTimeout(2000)
  
  // Find the schedule section
  const scheduleSection = page.locator('article').filter({ hasText: 'Schedule' })
  await expect(scheduleSection).toBeVisible({ timeout: 10000 })
  
  // Find the right arrow (second SVG in the schedule date container)
  // The schedule has a ToggleDate component with two SVG arrows
  const dateContainer = scheduleSection.locator('div').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })
  const arrows = dateContainer.locator('svg')
  const rightArrow = arrows.nth(1) // Second SVG is the right arrow
  
  // Try clicking with force to bypass overlay
  try {
    await rightArrow.click({ force: true, timeout: 5000 })
  } catch (e) {
    // If force click fails, try scrolling and clicking
    await rightArrow.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await rightArrow.click({ force: true })
  }
  
  // Wait for schedule to update
  await page.waitForTimeout(2000)
}

/**
 * Find and click on a lesson link in the schedule
 * Returns the lesson URL if found, or null
 */
export async function findLessonInSchedule(page: Page): Promise<string | null> {
  // Wait for schedule to load
  await page.waitForTimeout(2000)
  
  // Look for lesson links
  const lessonLinks = page.locator('a[href*="/bookings/"]')
  const count = await lessonLinks.count()
  
  if (count > 0) {
    const firstLink = lessonLinks.first()
    const href = await firstLink.getAttribute('href')
    return href || null
  }
  
  return null
}














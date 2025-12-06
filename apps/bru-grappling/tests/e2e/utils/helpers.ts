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














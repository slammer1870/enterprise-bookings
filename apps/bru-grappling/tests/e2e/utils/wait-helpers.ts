import { Page } from '@playwright/test'

/**
 * Optimized wait helpers that replace waitForTimeout with proper waiting strategies
 */

/**
 * Wait for element to be visible and ready (replaces waitForTimeout after actions)
 */
export async function waitForElementReady(page: Page, selector: string, timeout = 2000) {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout })
  } catch {
    // Element might not exist, that's ok
  }
}

/**
 * Wait for network to be idle or timeout quickly
 */
export async function waitForNetworkIdle(page: Page, timeout = 2000) {
  try {
    await page.waitForLoadState('networkidle', { timeout })
  } catch {
    // Network might not be idle, continue anyway
  }
}

/**
 * Wait for navigation to complete (replaces waitForTimeout after navigation)
 */
export async function waitForNavigation(page: Page, timeout = 2000) {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout })
  } catch {
    // Navigation might already be complete
  }
}

/**
 * Smart wait that checks if element is already visible before waiting
 */
export async function smartWait(page: Page, checkFn: () => Promise<boolean>, timeout = 1000) {
  if (await checkFn()) {
    return // Already ready
  }
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await checkFn()) {
      return
    }
    await page.waitForTimeout(100) // Small incremental wait
  }
}

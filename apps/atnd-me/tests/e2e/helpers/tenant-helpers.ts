import type { Page } from '@playwright/test'
import { navigateToTenant, getTenantContext } from './subdomain-helpers'

/**
 * Helper functions for tenant operations in E2E tests
 */

/**
 * Verify tenant home page is displayed
 * @param page - Playwright page object
 * @param tenantSlug - Expected tenant slug
 */
export async function verifyTenantHomePage(
  page: Page,
  tenantSlug: string
): Promise<boolean> {
  await navigateToTenant(page, tenantSlug)
  
  // Check that tenant context is set
  const tenantContext = await getTenantContext(page)
  if (tenantContext !== tenantSlug) {
    return false
  }

  // Check for tenant-specific content (schedule, navbar, etc.)
  // This is a basic check - can be expanded based on actual UI
  const hasSchedule = await page
    .locator('[data-testid="schedule"]')
    .or(page.locator('text=/schedule/i'))
    .isVisible()
    .catch(() => false)

  return hasSchedule
}

/**
 * Verify tenant context is set in API calls
 * This intercepts API calls and checks for tenant context
 * @param page - Playwright page object
 * @param tenantSlug - Expected tenant slug
 */
export async function verifyTenantContextInAPI(
  page: Page,
  tenantSlug: string
): Promise<boolean> {
  let hasTenantContext = false

  // Intercept API calls
  page.on('request', (request) => {
    const url = request.url()
    // Check if it's a Payload API call
    if (url.includes('/api/')) {
      const headers = request.headers()
      // Check for tenant context in headers or cookies
      if (headers['x-tenant-slug'] === tenantSlug) {
        hasTenantContext = true
      }
    }
  })

  await navigateToTenant(page, tenantSlug)
  await page.waitForTimeout(1000) // Wait for API calls

  return hasTenantContext
}

/**
 * Verify tenant-specific content is displayed
 * @param page - Playwright page object
 * @param tenantSlug - Tenant slug
 * @param expectedContent - Expected content text or selector
 */
export async function verifyTenantContent(
  page: Page,
  tenantSlug: string,
  expectedContent: string
): Promise<boolean> {
  await navigateToTenant(page, tenantSlug)
  
  const hasContent = await page
    .locator(`text=${expectedContent}`)
    .isVisible()
    .catch(() => false)

  return hasContent
}

/**
 * Verify tenant isolation - content from other tenant is not shown
 * @param page - Playwright page object
 * @param tenantSlug - Current tenant slug
 * @param otherTenantContent - Content that should NOT be visible
 */
export async function verifyTenantIsolation(
  page: Page,
  tenantSlug: string,
  otherTenantContent: string
): Promise<boolean> {
  await navigateToTenant(page, tenantSlug)
  
  const hasOtherContent = await page
    .locator(`text=${otherTenantContent}`)
    .isVisible()
    .catch(() => false)

  // Should return false (other tenant's content should NOT be visible)
  return !hasOtherContent
}

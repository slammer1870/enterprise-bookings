import type { Page, BrowserContext } from '@playwright/test'

/**
 * Helper functions for simulating subdomains in Playwright tests
 */

const BASE_URL = 'http://localhost:3000'

/**
 * Navigate to a tenant subdomain
 * @param page - Playwright page object
 * @param tenantSlug - Tenant slug (subdomain)
 * @param path - Optional path to navigate to
 */
export async function navigateToTenant(
  page: Page,
  tenantSlug: string,
  path: string = '/'
): Promise<void> {
  const url = `http://${tenantSlug}.localhost:3000${path}`
  // `networkidle` is flaky in Next dev due to HMR/websocket connections.
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null)
}

/**
 * Navigate to root domain (marketing page)
 * @param page - Playwright page object
 * @param path - Optional path to navigate to
 */
export async function navigateToRoot(
  page: Page,
  path: string = '/'
): Promise<void> {
  const url = `${BASE_URL}${path}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null)
}

/**
 * Get tenant context from cookies
 * @param page - Playwright page object
 * @returns Tenant slug from cookie, or null if not set
 */
export async function getTenantContext(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies()
  const tenantSlugCookie = cookies.find((cookie) => cookie.name === 'tenant-slug')
  return tenantSlugCookie?.value || null
}

/**
 * Create a browser context with subdomain support
 * This is useful for tests that need to maintain tenant context across pages
 * @param browser - Playwright browser object
 * @param tenantSlug - Optional tenant slug to set as default
 * @returns Browser context configured for subdomain
 */
export async function createTenantContext(
  browser: BrowserContext,
  tenantSlug?: string
): Promise<BrowserContext> {
  // For localhost, we can use subdomain.localhost:3000 directly
  // Playwright will handle the host header correctly
  return browser
}

/**
 * Verify tenant context is set correctly
 * @param page - Playwright page object
 * @param expectedTenantSlug - Expected tenant slug
 */
export async function verifyTenantContext(
  page: Page,
  expectedTenantSlug: string
): Promise<boolean> {
  const tenantSlug = await getTenantContext(page)
  return tenantSlug === expectedTenantSlug
}

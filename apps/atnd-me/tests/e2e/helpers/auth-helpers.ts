import type { Page } from '@playwright/test'

/**
 * Helper functions for authentication in E2E tests
 */

const BASE_URL = 'http://localhost:3000'

async function fillLoginFormAndSubmit(page: Page, email: string, password: string) {
  // Wait for login form to be visible (Better Auth UI can hydrate asynchronously)
  const emailInput = page
    .getByRole('textbox', { name: /email/i })
    .or(page.getByLabel(/email/i))
    .first()

  const passwordInput = page
    .getByRole('textbox', { name: /password/i })
    .or(page.getByLabel(/password/i))
    .first()

  const submitButton = page
    .getByRole('button', { name: /login|sign in/i })
    .or(page.locator('button[type="submit"]'))
    .first()

  await emailInput.waitFor({ state: 'visible', timeout: 20000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 20000 })

  await emailInput.fill(email)
  await passwordInput.fill(password)

  await submitButton.waitFor({ state: 'visible', timeout: 20000 })
  await submitButton.click()
}

/**
 * Login as a user with email and password
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 */
export async function loginAsUser(
  page: Page,
  email: string,
  password: string,
  opts?: { baseURL?: string }
): Promise<void> {
  const baseURL = opts?.baseURL || BASE_URL
  await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: 'domcontentloaded' })

  await fillLoginFormAndSubmit(page, email, password)

  // Wait for navigation after login (redirect away from sign-in view).
  await page
    .waitForURL((url) => !url.pathname.includes('/auth/sign-in'), { timeout: 20000 })
    .catch(() => null)
  await page.waitForLoadState('networkidle').catch(() => null)
}

/**
 * Login to the Payload admin panel (uses `/admin/login`).
 */
export async function loginToAdminPanel(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // Prefer API login to avoid flaky admin UI hydration / navigation timing.
  // Payload uses the auth-enabled Users collection at `/api/users/login`.
  const apiLogin = await page.request.post(`${BASE_URL}/api/users/login`, {
    data: { email, password },
  })

  if (apiLogin.ok()) {
    // Cookies from `page.request` are stored in the browser context, so the admin UI should be authenticated.
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL((url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'), {
        timeout: 20000,
      })
      .catch(() => null)

    // If we still landed on login, fall through to UI-based login to get error context.
    if (!page.url().includes('/admin/login')) {
      await page.waitForTimeout(500)
      return
    }
  }

  // Fallback: UI login (keeps the test output useful if auth endpoint changes)
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' })
  await fillLoginFormAndSubmit(page, email, password)

  // Wait for navigation away from login page
  await page
    .waitForURL((url) => !url.pathname.startsWith('/admin/login'), { timeout: 20000 })
    .catch(() => {
      // If still on login page, check if there's an error
      const currentUrl = page.url()
      if (currentUrl.includes('/admin/login')) {
        throw new Error(`Login failed - still on login page: ${currentUrl}`)
      }
    })
  
  // Wait a bit for admin panel to fully load
  await page.waitForTimeout(1000)
}

/**
 * Login as super admin
 * @param page - Playwright page object
 * @param email - Admin email (default: admin@test.com, or use worker-scoped email from testData)
 * @param password - Admin password (default: password)
 */
export async function loginAsSuperAdmin(
  page: Page,
  email: string = 'admin@test.com',
  password: string = 'password'
): Promise<void> {
  await loginToAdminPanel(page, email, password)
}

/**
 * Login as tenant-admin for a specific tenant
 * @param page - Playwright page object
 * @param tenantNumber - Tenant number (1, 2, etc.)
 * @param email - Tenant admin email (default: tenant-admin-{number}@test.com, or use worker-scoped email from testData)
 * @param password - Tenant admin password (default: password)
 */
export async function loginAsTenantAdmin(
  page: Page,
  tenantNumber: number = 1,
  email?: string,
  password: string = 'password'
): Promise<void> {
  const adminEmail = email || `tenant-admin-${tenantNumber}@test.com`
  await loginToAdminPanel(page, adminEmail, password)
}

/**
 * Login as regular user
 * @param page - Playwright page object
 * @param userNumber - User number (1, 2, etc.)
 * @param email - User email (default: user{number}@test.com, or use worker-scoped email from testData)
 * @param password - User password (default: password)
 */
export async function loginAsRegularUser(
  page: Page,
  userNumber: number = 1,
  email?: string,
  password: string = 'password',
  opts?: { tenantSlug?: string }
): Promise<void> {
  const userEmail = email || `user${userNumber}@test.com`
  const baseURL = opts?.tenantSlug
    ? `http://${opts.tenantSlug}.localhost:3000`
    : BASE_URL
  await loginAsUser(page, userEmail, password, { baseURL })
}

/**
 * Logout current user
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button/link
  const logoutButton = page
    .locator('button:has-text("Logout")')
    .or(page.locator('button:has-text("Sign Out")'))
    .or(page.locator('a:has-text("Logout")'))
    .or(page.locator('a:has-text("Sign Out")'))
    .first()

  const isVisible = await logoutButton.isVisible().catch(() => false)
  if (isVisible) {
    await logoutButton.click()
    await page.waitForLoadState('networkidle')
  }
}

/**
 * Check if user is logged in
 * @param page - Playwright page object
 * @returns True if user appears to be logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for common logged-in indicators
  const hasUserMenu = await page
    .locator('[data-testid="user-menu"]')
    .or(page.locator('button:has-text("Logout")'))
    .or(page.locator('a:has-text("Logout")'))
    .isVisible()
    .catch(() => false)

  const isOnLoginPage = page.url().includes('/auth/sign-in')
  return hasUserMenu && !isOnLoginPage
}

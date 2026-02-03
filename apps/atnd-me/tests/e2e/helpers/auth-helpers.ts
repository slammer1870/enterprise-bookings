import type { APIRequestContext, BrowserContext, Page } from '@playwright/test'

/**
 * Helper functions for authentication in E2E tests
 * When PW_SKIP_WEB_SERVER=1, use 127.0.0.1 to avoid IPv6 (::1) connection refused.
 */
export const BASE_URL =
  process.env.PW_SKIP_WEB_SERVER === '1' ? 'http://127.0.0.1:3000' : 'http://localhost:3000'

const ROOT_URL = 'http://localhost:3000'

function tenantBaseUrl(tenantSlug: string): string {
  // Tenant routing in tests is always via `subdomain.localhost:3000`.
  return `http://${tenantSlug}.localhost:3000`
}

function toDomainCookie(
  cookie: Awaited<ReturnType<BrowserContext['cookies']>>[number],
  domain: string
) {
  // Use the canonical Playwright cookie shape: domain + path.
  // This avoids `addCookies` complaining about missing url/path.
  return {
    name: cookie.name,
    value: cookie.value,
    domain,
    path: cookie.path || '/',
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  }
}

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

  // Wait for navigation after login (redirect away from sign-in view)
  await page
    .waitForURL((url) => !url.pathname.includes('/auth/sign-in'), { timeout: 20000 })
    .catch(() => null)
  
  // IMPORTANT: Wait for network to settle after redirect
  await page.waitForLoadState('networkidle').catch(() => null)
  
  // Additional wait to ensure session is fully established
  await page.waitForTimeout(500)
}

/**
 * Login to the Payload admin panel (uses `/admin/login`).
 * Pass the Playwright `request` fixture when available so the API call does not depend on
 * page.request (avoids "Target page, context or browser has been closed" with worker-scoped fixtures).
 */
export async function loginToAdminPanel(
  page: Page,
  email: string,
  password: string,
  opts?: { request?: APIRequestContext }
): Promise<void> {
  const apiRequest = opts?.request ?? page.request
  const apiLogin = await apiRequest.post(`${BASE_URL}/api/users/login`, {
    data: { email, password },
  })

  if (apiLogin.ok()) {
    // If we used the standalone request fixture, copy its cookies into the page context.
    if (opts?.request) {
      const state = await opts.request.storageState()
      if (state.cookies.length) {
        await page.context().addCookies(state.cookies)
      }
    }
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
 * @param passwordOrOpts - Admin password (default: password) or opts { request, password }
 * @param opts - Optional { request } - pass the Playwright request fixture to avoid page.request lifecycle issues
 */
export async function loginAsSuperAdmin(
  page: Page,
  email: string = 'admin@test.com',
  passwordOrOpts: string | { request?: APIRequestContext; password?: string } = 'password',
  opts?: { request?: APIRequestContext }
): Promise<void> {
  const password =
    typeof passwordOrOpts === 'string'
      ? passwordOrOpts
      : passwordOrOpts.password ?? 'password'
  const requestOpts = typeof passwordOrOpts === 'object' && passwordOrOpts.request != null
    ? { request: passwordOrOpts.request }
    : opts
  await loginToAdminPanel(page, email ?? 'admin@test.com', password, requestOpts)
}

/**
 * Login as tenant-admin for a specific tenant
 * @param page - Playwright page object
 * @param tenantNumber - Tenant number (1, 2, etc.)
 * @param email - Tenant admin email (default: tenant-admin-{number}@test.com, or use worker-scoped email from testData)
 * @param passwordOrOpts - Tenant admin password (default: password) or opts { request, password }
 */
export async function loginAsTenantAdmin(
  page: Page,
  tenantNumber: number = 1,
  email?: string,
  passwordOrOpts: string | { request?: APIRequestContext; password?: string } = 'password'
): Promise<void> {
  const adminEmail = email || `tenant-admin-${tenantNumber}@test.com`
  const password =
    typeof passwordOrOpts === 'string'
      ? passwordOrOpts
      : passwordOrOpts.password ?? 'password'
  const requestOpts =
    typeof passwordOrOpts === 'object' && passwordOrOpts.request != null
      ? { request: passwordOrOpts.request }
      : undefined
  await loginToAdminPanel(page, adminEmail, password, requestOpts)
}

/**
 * Login as regular user
 * @param page - Playwright page object
 * @param userNumber - User number (1, 2, etc.)
 * @param email - User email (default: user{number}@test.com, or use worker-scoped email from testData)
 * @param password - User password (default: password)
 * @param opts - Optional { tenantSlug } - sets tenant context via cookie
 */
export async function loginAsRegularUser(
  page: Page,
  userNumber: number = 1,
  email?: string,
  password: string = 'password',
  opts?: { tenantSlug?: string }
): Promise<void> {
  const userEmail = email || `user${userNumber}@test.com`
  
  // For tenant-scoped tests, login directly on the tenant host so session cookies are host-scoped correctly.
  const authBaseURL = opts?.tenantSlug ? tenantBaseUrl(opts.tenantSlug) : BASE_URL
  await loginAsUser(page, userEmail, password, { baseURL: authBaseURL })

  if (opts?.tenantSlug) {
    const tenantDomain = `${opts.tenantSlug}.localhost`
    await page.context().addCookies([
      { name: 'tenant-slug', value: opts.tenantSlug, domain: tenantDomain, path: '/' },
    ])
  }
}

/**
 * Log in as regular user via Better Auth API (sign-in/email).
 * Session cookies are stored in the page context. Use before navigating to protected routes (e.g. booking page).
 */
export async function loginAsRegularUserViaApi(
  page: Page,
  email: string,
  password: string,
  opts?: { baseURL?: string }
): Promise<void> {
  const baseURL = opts?.baseURL ?? BASE_URL
  const res = await page.request.post(`${baseURL}/api/auth/sign-in/email`, {
    data: { email: email.toLowerCase(), password },
    failOnStatusCode: false,
  })
  if (!res.ok()) {
    const text = await res.text().catch(() => '')
    throw new Error(`API sign-in failed: ${res.status()} ${text}`)
  }
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

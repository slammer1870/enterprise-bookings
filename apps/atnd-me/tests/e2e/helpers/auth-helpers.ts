import type { APIRequestContext, BrowserContext, Page } from '@playwright/test'

/**
 * Helper functions for authentication in E2E tests
 * When PW_SKIP_WEB_SERVER=1, use 127.0.0.1 to avoid IPv6 (::1) connection refused.
 */
export const BASE_URL =
  process.env.PW_SKIP_WEB_SERVER === '1' ? 'http://127.0.0.1:3000' : 'http://localhost:3000'

const _ROOT_URL = 'http://localhost:3000'

function tenantBaseUrl(tenantSlug: string): string {
  // Tenant routing in tests is always via `subdomain.localhost:3000`.
  return `http://${tenantSlug}.localhost:3000`
}

/**
 * Node's DNS often does not resolve `*.localhost` (getaddrinfo ENOTFOUND), while browsers usually do.
 * For API calls, connect to the same TCP origin as `BASE_URL` and send the tenant virtual host.
 *
 * @param logicalOrigin - e.g. `http://slug.localhost:3000`
 * @param apiPath - path starting with `/`, e.g. `/api/users/login`
 */
function resolveLocalhostTenantApiRequest(
  logicalOrigin: string,
  apiPath: string
): { url: string; extraHeaders?: Record<string, string> } {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  try {
    const logical = new URL(logicalOrigin)
    const root = new URL(BASE_URL)
    const isTenantSubdomainLocalhost =
      logical.hostname.includes('localhost') &&
      logical.hostname !== 'localhost' &&
      logical.hostname.endsWith('.localhost')
    if (isTenantSubdomainLocalhost) {
      return {
        url: `${root.origin}${path}`,
        extraHeaders: { Host: logical.host },
      }
    }
    return { url: `${logicalOrigin.replace(/\/$/, '')}${path}` }
  } catch {
    return { url: `${logicalOrigin.replace(/\/$/, '')}${path}` }
  }
}

/** Worker `request` + POST to loopback with `Host: slug.localhost` can file cookies under localhost; remap for tenant navigation. */
function remapCookiesForTenantAdminOrigin(
  cookies: { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None' }[],
  adminOrigin: string
): typeof cookies {
  try {
    const u = new URL(adminOrigin)
    if (!u.hostname.endsWith('.localhost') || u.hostname === 'localhost') {
      return cookies
    }
    const tenantHost = u.hostname
    return cookies.map((c) => {
      const raw = c.domain || ''
      const dom = raw.replace(/^\./, '')
      if (dom === tenantHost) return c
      // Loopback connection host / missing domain → wrong host for `*.localhost` navigation
      if (dom === 'localhost' || dom === '127.0.0.1' || dom === '') {
        return { ...c, domain: tenantHost }
      }
      return c
    })
  } catch {
    return cookies
  }
}

function _toDomainCookie(
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
    .or(page.locator('input[type="email"]'))
    .first()

  // Password inputs have type="password" so they're not textboxes
  const passwordInput = page
    .getByLabel(/password/i)
    .or(page.locator('input[type="password"]'))
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

  // Additional wait to ensure session is fully established.
  // Ignore "Target page, context or browser has been closed" (e.g. test timeout / teardown during wait).
  await page.waitForTimeout(500).catch((err: Error) => {
    if (err?.message?.includes('closed')) return
    throw err
  })
}

/**
 * Login to the Payload admin panel (uses `/admin/login`).
 * Pass the Playwright `request` fixture when available so the API call does not depend on
 * page.request (avoids "Target page, context or browser has been closed" with worker-scoped fixtures).
 *
 * @param opts.adminOrigin - When set (e.g. `http://tenant-slug.localhost:3000`), login + session cookies
 *   are scoped to that host. Required for admin flows on tenant subdomains (localhost root cookies are not sent there).
 */
export async function loginToAdminPanel(
  page: Page,
  email: string,
  password: string,
  opts?: { request?: APIRequestContext; adminOrigin?: string }
): Promise<void> {
  const origin = opts?.adminOrigin ?? BASE_URL
  const apiRequest = opts?.request ?? page.request
  const { url: apiLoginUrl, extraHeaders } = opts?.adminOrigin
    ? resolveLocalhostTenantApiRequest(opts.adminOrigin, '/api/users/login')
    : { url: `${BASE_URL}/api/users/login`, extraHeaders: undefined }
  const apiLogin = await apiRequest.post(apiLoginUrl, {
    data: { email, password },
    headers: extraHeaders,
  })

  if (apiLogin.ok()) {
    // After API login, ensure session cookies exist in the browser context.
    // `apiRequest` cookie jar isn't guaranteed to be synced to `page.context()` automatically.
    const state = await apiRequest.storageState()
    const cookies = opts?.adminOrigin
      ? remapCookiesForTenantAdminOrigin(state.cookies, opts.adminOrigin)
      : state.cookies
    if (cookies.length) {
      await page.context().addCookies(cookies)
    }
    await page.goto(`${origin}/admin`, { waitUntil: 'domcontentloaded' })
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
  await page.goto(`${origin}/admin/login`, { waitUntil: 'domcontentloaded' })
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
  passwordOrOpts:
    | string
    | { request?: APIRequestContext; password?: string; tenantSlug?: string } = 'password'
): Promise<void> {
  const adminEmail = email || `tenant-admin-${tenantNumber}@test.com`
  const password =
    typeof passwordOrOpts === 'string'
      ? passwordOrOpts
      : passwordOrOpts.password ?? 'password'
  const optsObj = typeof passwordOrOpts === 'object' ? passwordOrOpts : undefined
  const request = optsObj?.request
  const tenantSlug = optsObj?.tenantSlug
  const adminOrigin = tenantSlug ? tenantBaseUrl(tenantSlug) : undefined
  await loginToAdminPanel(page, adminEmail, password, {
    ...(request != null ? { request } : {}),
    ...(adminOrigin != null ? { adminOrigin } : {}),
  })
}

/** Cookie names that indicate auth/session (Better Auth). */
const SESSION_COOKIE_NAMES = /^(better-auth\.|session_token|session_data|dont_remember)/

/**
 * Copy session cookies from the current context to a tenant subdomain so they're
 * sent when navigating to tenantSlug.localhost (auth often sets cookies for the
 * request host, which can be the main domain when the form posts there).
 */
function copySessionCookiesToTenantDomain(
  cookies: Awaited<ReturnType<BrowserContext['cookies']>>,
  tenantSlug: string
): Parameters<BrowserContext['addCookies']>[0] {
  const tenantDomain = `${tenantSlug}.localhost`
  return cookies
    .filter((c) => SESSION_COOKIE_NAMES.test(c.name))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: tenantDomain,
      path: c.path || '/',
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }))
}

/**
 * Login as regular user
 * @param page - Playwright page object
 * @param userNumber - User number (1, 2, etc.)
 * @param email - User email (default: user{number}@test.com, or use worker-scoped email from testData)
 * @param password - User password (default: password)
 * @param opts - Optional { tenantSlug } - sets tenant context via cookie; when set, also copies session cookies to tenant subdomain so protected routes on tenant host receive auth
 */
export async function loginAsRegularUser(
  page: Page,
  userNumber: number = 1,
  email?: string,
  password: string = 'password',
  opts?: { tenantSlug?: string }
): Promise<void> {
  const userEmail = email || `user${userNumber}@test.com`

  // Prefer API-based login for stability (avoids UI flake + avoids accessing cookies on a closing context).
  const authBaseURL = opts?.tenantSlug ? tenantBaseUrl(opts.tenantSlug) : BASE_URL
  try {
    await loginAsRegularUserViaApi(page, userEmail, password, {
      baseURL: authBaseURL,
      tenantSlug: opts?.tenantSlug,
    })
    return
  } catch {
    // Fall back to UI-based login if the auth API changes.
  }

  await loginAsUser(page, userEmail, password, { baseURL: authBaseURL })

  if (opts?.tenantSlug) {
    try {
      const tenantDomain = `${opts.tenantSlug}.localhost`
      const cookies = await page.context().cookies()
      const tenantSessionCookies = copySessionCookiesToTenantDomain(cookies, opts.tenantSlug)
      if (tenantSessionCookies.length) {
        await page.context().addCookies(tenantSessionCookies)
      }
      await page.context().addCookies([
        { name: 'tenant-slug', value: opts.tenantSlug, domain: tenantDomain, path: '/' },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Target page, context or browser has been closed')) return
      throw err
    }
  }
}

/**
 * Log in as regular user via Better Auth API (sign-in/email).
 * Session cookies are stored in the page context. Use before navigating to protected routes (e.g. booking page).
 * @param opts.tenantSlug - When set, copies session cookies to this subdomain (tenantSlug.localhost) so protected routes on the tenant host receive auth; also sets tenant-slug cookie.
 */
export async function loginAsRegularUserViaApi(
  page: Page,
  email: string,
  password: string,
  opts?: { baseURL?: string; request?: APIRequestContext; tenantSlug?: string }
): Promise<void> {
  const baseURL = opts?.baseURL ?? BASE_URL
  const apiRequest = opts?.request ?? page.request
  // Better Auth can rate limit sign-in. In E2E, multiple workers/tests can hit this concurrently.
  // Prefer avoiding repeated logins entirely (storageState per worker), but keep this resilient.
  const maxAttempts = 10
  let lastStatus: number | null = null
  let lastBody = ''

  // Decorrelated jitter backoff (prevents thundering herd).
  let backoffMs = 250

  const { url: signInUrl, extraHeaders: signInHeaders } = resolveLocalhostTenantApiRequest(
    baseURL,
    '/api/auth/sign-in/email'
  )

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await apiRequest.post(signInUrl, {
      data: { email: email.toLowerCase(), password },
      failOnStatusCode: false,
      headers: signInHeaders,
    })

    if (res.ok()) break

    lastStatus = res.status()
    lastBody = await res.text().catch(() => '')

    // Retry only on explicit rate limiting. All other failures should surface immediately.
    if (lastStatus !== 429 || attempt === maxAttempts) {
      throw new Error(`API sign-in failed: ${lastStatus} ${lastBody}`)
    }

    const retryAfterHeader = res.headers()['retry-after']
    const retryAfterSec = retryAfterHeader != null ? Number(retryAfterHeader) : NaN

    // If server tells us how long to wait, respect it (don't cap to 5s).
    // Otherwise, use decorrelated jitter with a sane cap to keep tests moving.
    const delayMs = Number.isFinite(retryAfterSec)
      ? Math.min(30_000, Math.max(250, Math.floor(retryAfterSec * 1000)))
      : Math.min(30_000, Math.max(250, Math.floor(backoffMs * (1.5 + Math.random()))))

    backoffMs = delayMs
    await new Promise((r) => setTimeout(r, delayMs))
  }

  // Copy cookies from the request context into the browser context.
  // Playwright's API request cookie jar is not guaranteed to sync to the page context automatically.
  const state = await apiRequest.storageState()
  if (state.cookies.length) {
    await page.context().addCookies(state.cookies)
    if (opts?.tenantSlug) {
      const tenantSessionCookies = copySessionCookiesToTenantDomain(state.cookies, opts.tenantSlug)
      if (tenantSessionCookies.length) {
        await page.context().addCookies(tenantSessionCookies)
      }
      const tenantDomain = `${opts.tenantSlug}.localhost`
      await page.context().addCookies([
        { name: 'tenant-slug', value: opts.tenantSlug, domain: tenantDomain, path: '/' },
      ])
    }
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
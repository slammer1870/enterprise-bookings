import type { APIRequestContext, Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const DEV_USER = { email: 'admin@test.com', password: 'password' }

/**
 * Ensure the dev app has at least 2 tenants via API (so the tenant selector is visible).
 * Call once before tenant-selector tests (e.g. in beforeAll). Uses super-admin login.
 */
export async function ensureAtLeastTwoTenants(request: APIRequestContext): Promise<void> {
  const loginRes = await request.post(`${BASE_URL}/api/users/login`, {
    data: { email: DEV_USER.email, password: DEV_USER.password },
  })
  if (!loginRes.ok()) {
    throw new Error(
      `ensureAtLeastTwoTenants: login failed (${loginRes.status()}). Start the dev server (pnpm dev) and ensure seed has run (admin@test.com / password).`,
    )
  }

  const listRes = await request.get(`${BASE_URL}/api/tenants?limit=20`)
  if (!listRes.ok()) {
    throw new Error(`ensureAtLeastTwoTenants: list tenants failed (${listRes.status()}).`)
  }
  const body = (await listRes.json()) as { totalDocs?: number; docs?: { id: string; name?: string }[] }
  const docs = body.docs ?? []
  const existingNames = new Set((docs as { name?: string }[]).map((d) => d.name).filter(Boolean))
  if (docs.length >= 2) return

  const names = ['Test Tenant 1', 'Test Tenant 2']
  for (const name of names) {
    if (existingNames.has(name)) continue
    const createRes = await request.post(`${BASE_URL}/api/tenants`, { data: { name } })
    if (createRes.ok()) {
      existingNames.add(name)
      continue
    }
    const err = (await createRes.json().catch(() => ({}))) as { errors?: { message: string }[] }
    const msg = err?.errors?.[0]?.message ?? createRes.statusText()
    throw new Error(`Failed to create tenant "${name}": ${msg}. Ensure dev server is running and seed user exists.`)
  }
}

/**
 * Login to Payload admin panel via /api/users/login and sync cookies to the page context.
 */
export async function loginToAdminPanel(
  page: Page,
  email: string,
  password: string,
  opts?: { request?: APIRequestContext },
): Promise<void> {
  const apiRequest = opts?.request ?? page.request
  const res = await apiRequest.post(`${BASE_URL}/api/users/login`, {
    data: { email, password },
  })

  if (res.ok()) {
    if (opts?.request) {
      const state = await opts.request.storageState()
      if (state.cookies.length) {
        await page.context().addCookies(state.cookies)
      }
    }
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 20_000 },
      )
      .catch(() => null)
    if (!page.url().includes('/admin/login')) {
      await page.waitForTimeout(500)
      return
    }
  }

  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' })
  const errorOverlay = page.getByRole('dialog').filter({ has: page.getByText(/ReferenceError|Error/i) })
  if (await errorOverlay.isVisible().catch(() => false)) {
    const msg = await page.getByText(/require is not defined|SyntaxError/i).first().textContent().catch(() => 'App runtime error')
    throw new Error(`App crashed before login page: ${msg}. Fix the dev app (e.g. ESM/require in server bundle), then re-run the test.`)
  }
  const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]')).first()
  const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]')).first()
  const submitButton = page.getByRole('button', { name: /login|sign in/i }).or(page.locator('button[type="submit"]')).first()
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 20_000 })
  await emailInput.fill(email)
  await passwordInput.fill(password)
  await submitButton.click()
  await page
    .waitForURL((url) => !url.pathname.startsWith('/admin/login'), { timeout: 20_000 })
    .catch(() => {
      if (page.url().includes('/admin/login')) {
        throw new Error(`Login failed - still on login page`)
      }
    })
  await page.waitForTimeout(1000)
}

/**
 * Login as super admin. Uses admin@test.com / password by default.
 */
export async function loginAsSuperAdmin(
  page: Page,
  email: string = 'admin@test.com',
  passwordOrOpts: string | { request?: APIRequestContext; password?: string } = 'password',
  opts?: { request?: APIRequestContext },
): Promise<void> {
  const password =
    typeof passwordOrOpts === 'string'
      ? passwordOrOpts
      : passwordOrOpts?.password ?? 'password'
  const requestOpts =
    typeof passwordOrOpts === 'object' && passwordOrOpts?.request != null
      ? { request: passwordOrOpts.request }
      : opts
  await loginToAdminPanel(page, email, password, requestOpts)
}

export { BASE_URL }

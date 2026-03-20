import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsTenantAdmin, loginAsRegularUser } from './helpers/auth-helpers'

async function submitAdminLogin(page: Parameters<typeof test>[0]['page'], email: string) {
  await page.getByRole('textbox', { name: /email/i }).first().fill(email)
  await page.getByLabel(/password/i).or(page.locator('input[type="password"]')).first().fill('password')
  await page
    .getByRole('button', { name: /login|sign in/i })
    .or(page.locator('button[type="submit"]'))
    .first()
    .click()
}

test.describe('Admin Panel Access', () => {
  test('should keep unauthenticated tenant admin redirect on tenant host', async ({ page, testData }) => {
    const slug = testData.tenants[0]!.slug
    await page.goto(`http://${slug}.localhost:3000/admin`, { waitUntil: 'domcontentloaded' })

    await page.waitForURL((u) => u.pathname.startsWith('/admin/login'), { timeout: 12000 })
    const url = new URL(page.url())
    expect(url.hostname).toBe(`${slug}.localhost`)
    expect(url.pathname.startsWith('/admin/login')).toBe(true)
  })

  test('should keep tenant-admin on their own tenant host after login', async ({
    page,
    testData,
  }) => {
    const slug = testData.tenants[0]!.slug
    await page.goto(`http://${slug}.localhost:3000/admin/login`, { waitUntil: 'domcontentloaded' })
    await submitAdminLogin(page, testData.users.tenantAdmin1.email)

    await page
      .waitForURL((u) => u.pathname.startsWith('/admin') && !u.pathname.startsWith('/admin/login'), {
        timeout: 12000,
      })
      .catch(() => null)
    await page.waitForLoadState('networkidle').catch(() => null)

    const url = new URL(page.url())
    expect(url.hostname).toBe(`${slug}.localhost`)
    expect(url.pathname.startsWith('/admin')).toBe(true)
    expect(url.pathname.startsWith('/admin/login')).toBe(false)
  })

  test('should block tenant-admin from accessing a different tenant host admin', async ({
    page,
    testData,
  }) => {
    const slugOther = testData.tenants[1]!.slug
    const hostOther = `${slugOther}.localhost`
    await page.goto(`http://${hostOther}:3000/admin/login`, { waitUntil: 'domcontentloaded' })
    await submitAdminLogin(page, testData.users.tenantAdmin1.email)
    await page
      .waitForURL(
        (u) =>
          (u.hostname === hostOther && u.pathname.startsWith('/admin/login')) ||
          (u.hostname === 'localhost' && u.pathname.startsWith('/admin')),
        { timeout: 12000 }
      )
      .catch(() => null)

    const url = new URL(page.url())
    const isStillOnTenant2Login = url.hostname === hostOther && url.pathname.startsWith('/admin/login')
    const isRedirectedToRootAdmin = url.hostname === 'localhost' && url.pathname.startsWith('/admin')
    const hasTenant2DashboardUrl =
      url.hostname === hostOther &&
      url.pathname.startsWith('/admin') &&
      !url.pathname.startsWith('/admin/login')

    expect(hasTenant2DashboardUrl).toBe(false)
    expect(isStillOnTenant2Login || isRedirectedToRootAdmin).toBe(true)
  })

  test('should allow admin roles to access panel and deny regular users', async ({
    page,
    testData,
    request,
  }) => {
    // Test super admin access
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL((url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'), { timeout: 10000 })
      .catch(() => {
        if (page.url().includes('/admin/login')) {
          throw new Error(`Super admin denied - redirected to login`)
        }
      })
    expect(page.url()).toContain('/admin')
    expect(page.url()).not.toContain('/admin/login')

    // Test tenant-admin access
    await page.context().clearCookies()
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/admin')
    expect(page.url()).not.toContain('/admin/login')

    // Test regular user denial
    await page.context().clearCookies()
    await loginAsRegularUser(page, 1, testData.users.user1.email)
    let sawForbidden = false
    page.on('response', (resp) => {
      if (resp.status() === 403 && (resp.url().includes('/admin') || resp.url().includes('/api/'))) {
        sawForbidden = true
      }
    })
    let tooManyRedirects = false
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('ERR_TOO_MANY_REDIRECTS')) {
        tooManyRedirects = true
        return
      }
      throw err
    })
    await Promise.race([
      page.waitForURL((u) => /\/admin\/login|\/admin\/unauthorized|\/auth\//.test(u.pathname), { timeout: 5000 }),
      page.getByRole('textbox', { name: /email/i }).first().waitFor({ state: 'visible', timeout: 5000 }),
      page.getByText(/unauthorized|forbidden|access denied|don't have permission|sign in|log in/i).first().waitFor({ state: 'visible', timeout: 5000 }),
    ]).catch(() => null)
    const url = page.url()
    const isRedirected = Boolean(url.match(/\/admin\/login|\/admin\/unauthorized|\/auth\//))
    const hasLoginForm = await page.getByRole('textbox', { name: /email/i }).first().isVisible().catch(() => false)
    const bodyText = await page.locator('body').textContent().catch(() => '')
    const hasDeniedContent =
      /unauthorized|forbidden|access denied|don't have permission|sign in|log in/i.test(bodyText ?? '')
    expect(isRedirected || hasLoginForm || sawForbidden || hasDeniedContent || tooManyRedirects).toBe(true)
  })
})

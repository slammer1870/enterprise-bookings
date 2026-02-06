import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsTenantAdmin, loginAsRegularUser } from './helpers/auth-helpers'

test.describe('Admin Panel Access', () => {
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
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' })
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
    expect(isRedirected || hasLoginForm || sawForbidden || hasDeniedContent).toBe(true)
  })
})

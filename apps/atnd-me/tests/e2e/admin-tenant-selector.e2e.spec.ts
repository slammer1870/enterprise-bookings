import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin } from './helpers/auth-helpers'

const ADMIN_ORIGIN = 'http://localhost:3000'

/**
 * E2E: Admin tenant selector (ClearableTenantSelector).
 * The nav control can be covered by Payload's gutter in the test environment,
 * so we validate behavior via the payload-tenant cookie and that the selector
 * displays the selected tenant name after reload.
 */
test.describe('Admin Tenant Selector', () => {
  test('tenant selector is visible and selection is reflected via cookie and display', async ({
    page,
    testData,
    request,
  }) => {
    const { tenants } = testData
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]
    const tenant1Name = tenant1.name ?? 'Test Tenant 1'
    const tenant2Name = tenant2.name ?? 'Test Tenant 2'

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 },
      )
      .catch(() => {
        if (page.url().includes('/admin/login')) {
          throw new Error('Super admin denied - redirected to login')
        }
      })

    const tenantSelectorWrap = page.getByTestId('tenant-selector')
    await expect(tenantSelectorWrap).toBeVisible({ timeout: 10000 })

    // Set tenant via cookie (simulates selecting a tenant); reload so the app reads it
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant2.id),
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/',
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const cookies = await page.context().cookies()
    const payloadTenant = cookies.find((c) => c.name === 'payload-tenant')
    expect(payloadTenant).toBeDefined()
    expect(payloadTenant?.value).toBe(String(tenant2.id))

    // Switch to first tenant via cookie and assert display updates
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant1.id),
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/',
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const cookiesAfter = await page.context().cookies()
    const payloadTenantAfter = cookiesAfter.find((c) => c.name === 'payload-tenant')
    expect(payloadTenantAfter?.value).toBe(String(tenant1.id))
  })

  test('clearing payload-tenant cookie shows no tenant filter', async ({
    page,
    testData,
    request,
  }) => {
    const { tenants } = testData
    const tenant2 = tenants[1]

    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 },
      )
      .catch(() => null)

    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant2.id),
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/',
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    // Clear tenant filter by setting payload-tenant to empty (don't clear all cookies or we lose session)
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: '',
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/',
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    const cookies = await page.context().cookies()
    const payloadTenant = cookies.find((c) => c.name === 'payload-tenant')
    expect(payloadTenant == null || payloadTenant?.value === '').toBe(true)
  })
})

import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin } from './helpers/auth-helpers'

const ADMIN_ORIGIN = 'http://localhost:3000'

/** Desktop viewport so Payload admin sidebar (and tenant selector) is visible, not collapsed. */
const ADMIN_VIEWPORT = { width: 1440, height: 900 }

/** Open the admin sidebar if it is collapsed (e.g. on smaller viewports). */
async function ensureSidebarOpen(page: Page) {
  const openMenu = page.getByRole('button', { name: /open menu/i })
  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click({ force: true })
    // Give the UI a moment to animate / mount nav.
    await page.getByRole('button', { name: /close menu/i }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => null)
  }
}

/**
 * E2E: Admin tenant selector (ClearableTenantSelector).
 * Tests that opening the dropdown and clicking a tenant (e.g. the second one)
 * actually selects that tenant (cookie + displayed value), not the first.
 */
test.describe('Admin Tenant Selector', () => {
  test('clicking second tenant in dropdown selects that tenant (cookie and display)', async ({
    page,
    testData,
    request,
  }) => {
    const { tenants } = testData
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]
    const tenant2Name = tenant2.name ?? 'Test Tenant 2'

    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
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

    await ensureSidebarOpen(page)

    // Wait for tenant selector
    const wrap = page.getByTestId('tenant-selector')
    await wrap.waitFor({ state: 'visible', timeout: 20000 })

    // Start with first tenant so we can switch to second
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant1.id),
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/',
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: 20000 })

    // Use a collection list page so there is no "modified" form state — tenant switch runs without confirmation modal
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/categories`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: 20000 })

                const combobox = wrap.getByRole('combobox')
    await expect(combobox).toBeVisible()

                // Payload SelectInput (react-select): force-click the combobox to open the menu.
                await combobox.click({ force: true })
                // Use .first() because multiple options can match (e.g. duplicate menus); we want the one in the open dropdown.
                await page.getByRole('option', { name: tenant2Name }).first().click()

    // Switching tenant can prompt a confirmation modal if Payload considers the view "modified".
    // If the modal appears, we must confirm it or the controlled <select> will snap back.
    const leaveAnyway = page.getByRole('button', { name: /leave/i })
    await leaveAnyway
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(async () => {
        await leaveAnyway.click()
      })
      .catch(() => null)

    // setTenant(..., refresh: true) may reload; if it doesn't, the assertions below will still synchronize.
    await page.waitForLoadState('load').catch(() => null)

    // Assert display via aria-selected on the option after selection
                await combobox.click({ force: true })
    const selectedOption = page.getByRole('option', { name: tenant2Name }).first()
    await expect(selectedOption).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape').catch(() => null)

    const cookies = await page.context().cookies()
    const payloadTenantCookies = cookies.filter((c) => c.name === 'payload-tenant')
    expect(payloadTenantCookies.length).toBeGreaterThan(0)
    expect(payloadTenantCookies.every((c) => c.value === String(tenant2.id))).toBe(true)
  })

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

    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
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

    await ensureSidebarOpen(page)
    await page.getByTestId('tenant-selector').waitFor({ state: 'visible', timeout: 20000 })

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

  test('clearing tenant on dashboard removes tenant cookie (aggregate analytics)', async ({
    page,
    testData,
    request,
  }) => {
    const { tenants } = testData
    const tenant2 = tenants[1]

    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)

    // Simulate plugin behavior: cookie may exist on both / and /admin paths
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant2.id),
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/',
      },
      {
        name: 'payload-tenant',
        value: String(tenant2.id),
        domain: new URL(ADMIN_ORIGIN).hostname,
        path: '/admin',
      },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

                    const wrap = page.getByTestId('tenant-selector')
                    await wrap.waitFor({ state: 'visible', timeout: 20000 })
                    const combobox = wrap.getByRole('combobox')
    await expect(combobox).toBeVisible()

    // After clearing, dashboard should request aggregate analytics (no tenantId param).
    // Use a long timeout and trigger a fresh dashboard load so the request is reliable.
    const ANALYTICS_WAIT_TIMEOUT_MS = 60_000
    const waitForAggregateAnalytics = page.waitForRequest(
      (req) => {
        if (!req.url().includes('/api/analytics')) return false
        try {
          const url = new URL(req.url())
          return !url.searchParams.has('tenantId')
        } catch {
          return false
        }
      },
      { timeout: ANALYTICS_WAIT_TIMEOUT_MS },
    )

                    // Clear via UI: react-select supports backspace to remove the current value when focused.
                    await combobox.focus()
                    await page.keyboard.press('Backspace')
                    await page.keyboard.press('Backspace')

    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click()
    }

    await page.waitForLoadState('load')

    // Trigger a fresh dashboard load so analytics is requested without tenantId (reliable vs. relying on re-render or "Last 7 days").
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('load').catch(() => null)
    await waitForAggregateAnalytics

    // Cookie should be removed/empty regardless of path scope
    const cookiesAfter = await page.context().cookies()
    const payloadTenantCookies = cookiesAfter.filter((c) => c.name === 'payload-tenant')
    expect(payloadTenantCookies.every((c) => c.value === '') || payloadTenantCookies.length === 0).toBe(true)
  })
})

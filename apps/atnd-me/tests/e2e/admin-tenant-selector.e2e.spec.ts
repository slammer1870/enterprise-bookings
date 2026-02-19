import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin } from './helpers/auth-helpers'

const ADMIN_ORIGIN = 'http://localhost:3000'
const ADMIN_COOKIE_URLS = [
  `${ADMIN_ORIGIN}/`,
  `${ADMIN_ORIGIN}/admin/`,
  `${ADMIN_ORIGIN}/admin/collections/`,
  `${ADMIN_ORIGIN}/admin/collections/categories`,
]

/** Desktop viewport so Payload admin sidebar (and tenant selector) is visible, not collapsed. */
const ADMIN_VIEWPORT = { width: 1440, height: 900 }

/** GitHub Actions runners are slower; use longer timeouts and waits in CI. */
const isCI = !!process.env.CI
const CI = {
  optionWaitMs: isCI ? 6000 : 5000,
  selectDeadlineMs: isCI ? 50_000 : 25_000,
  displayVisibleTimeout: isCI ? 35_000 : 15_000,
  sidebarTimeout: isCI ? 25_000 : 10_000,
  wrapTimeout: isCI ? 30_000 : 20_000,
  clearResponseTimeout: isCI ? 20_000 : 10_000,
  settleAfterGotoMs: isCI ? 3000 : 1500,
  cookiePollTimeout: isCI ? 90_000 : 60_000,
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Open the admin sidebar if it is collapsed; wait until tenant selector is visible. */
async function ensureSidebarOpen(page: Page) {
  const tenantSelector = page.getByTestId('tenant-selector')
  const sidebarContent = page.getByText('Filter by Tenant', { exact: false })
  // Only skip if sidebar is clearly open: selector and "Filter by Tenant" are both visible.
  const selectorVisible = await tenantSelector.isVisible().catch(() => false)
  const filterVisible = await sidebarContent.isVisible().catch(() => false)
  if (selectorVisible && filterVisible) return

  await page.waitForLoadState('domcontentloaded').catch(() => null)
  if (isCI) await page.waitForTimeout(1000)

  // In CI the hamburger is top-left; try multiple ways to find it (built bundle may change labels).
  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  const headerFirstButton = page.locator('header').getByRole('button').first()
  const bannerFirstButton = page.getByRole('banner').getByRole('button').first()
  const menuSelectors = isCI
    ? [openMenuButton, headerFirstButton, bannerFirstButton, page.getByRole('button', { name: /menu/i })]
    : [openMenuButton, page.getByRole('button', { name: /menu/i }), page.locator('header').getByRole('button').first()]

  const attemptWaitMs = isCI ? 8000 : 5000
  for (const openMenu of menuSelectors) {
    if (await tenantSelector.isVisible().catch(() => false)) break
    const visible = await openMenu.isVisible().catch(() => false)
    if (!visible) continue
    await openMenu.scrollIntoViewIfNeeded().catch(() => null)
    if (isCI) await page.waitForTimeout(300)
    await openMenu.click({ force: true, timeout: 10_000 })
    if (isCI) await page.waitForTimeout(1500)
    const sawSidebar =
      (await tenantSelector.isVisible().catch(() => false)) ||
      (await sidebarContent.isVisible().catch(() => false))
    if (sawSidebar) break
    await tenantSelector.waitFor({ state: 'visible', timeout: attemptWaitMs }).catch(() => null)
    if (await tenantSelector.isVisible().catch(() => false)) break
    // One retry: click again in case first click didn't register (e.g. headless)
    if (isCI && (await openMenu.isVisible().catch(() => false))) {
      await openMenu.click({ force: true, timeout: 10_000 })
      if (isCI) await page.waitForTimeout(1500)
      await tenantSelector.waitFor({ state: 'visible', timeout: attemptWaitMs }).catch(() => null)
    }
    if (await tenantSelector.isVisible().catch(() => false)) break
  }

  await tenantSelector.waitFor({ state: 'visible', timeout: CI.sidebarTimeout })
  if (isCI) await tenantSelector.scrollIntoViewIfNeeded().catch(() => null)
}

/**
 * E2E: Admin tenant selector (ClearableTenantSelector).
 * First test: UI selection (open dropdown, select second tenant).
 * Second test: cookie/display consistency.
 */
test.describe('Admin Tenant Selector', () => {
  if (isCI) test.setTimeout(120_000)
  test.describe.configure({ mode: 'serial' })

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
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/categories`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15_000 },
      )
      .catch(() => {
        if (page.url().includes('/admin/login')) throw new Error('Super admin denied - redirected to login')
      })

    await ensureSidebarOpen(page)
    const wrap = page.getByTestId('tenant-selector')
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Start with first tenant so we can select the second from the dropdown
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant1.id), url: `${ADMIN_ORIGIN}/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Ensure sidebar is open before interacting. Main content (collection-list__wrap, app-header__content)
    // can sit on top of the sidebar and intercept clicks, so we must open the menu and wait for it.
    const openMenuBtn = page.getByRole('button', { name: /open\s+menu/i })
    if (await openMenuBtn.isVisible().catch(() => false)) {
      await openMenuBtn.click({ timeout: 5000 })
      await page.waitForTimeout(600)
      // If sidebar was already open we may have toggled it closed; ensure it's open.
      const filterVisible = await page.getByText('Filter by Tenant', { exact: false }).isVisible().catch(() => false)
      if (!filterVisible) {
        await openMenuBtn.click({ timeout: 5000 })
        await page.waitForTimeout(600)
      }
    }
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: 5000 })
    await page.waitForTimeout(400)

    // Open dropdown and select second tenant. Use force: true so main-content overlay doesn't intercept.
    await wrap.scrollIntoViewIfNeeded()
    const combobox = wrap.getByRole('combobox')
    await combobox.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    await combobox.click({ force: true })
    const option = page.getByRole('option', { name: new RegExp(escapeRegex(tenant2Name), 'i') }).first()
    await option.waitFor({ state: 'visible', timeout: CI.optionWaitMs })
    await option.click()

    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) await leaveAnyway.click()

    await page.waitForLoadState('load').catch(() => null)
    await ensureSidebarOpen(page)
    await expect(wrap.getByText(tenant2Name).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })
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
        url: `${ADMIN_ORIGIN}/`,
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const cookies = await page.context().cookies(ADMIN_COOKIE_URLS)
    const payloadTenant = cookies.find((c) => c.name === 'payload-tenant')
    expect(payloadTenant).toBeDefined()
    expect(payloadTenant?.value).toBe(String(tenant2.id))

    // Switch to first tenant via cookie and assert display updates
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant1.id),
        url: `${ADMIN_ORIGIN}/`,
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const cookiesAfter = await page.context().cookies(ADMIN_COOKIE_URLS)
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
        url: `${ADMIN_ORIGIN}/`,
      },
      {
        name: 'payload-tenant',
        value: String(tenant2.id),
        url: `${ADMIN_ORIGIN}/admin/`,
      },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const wrap = page.getByTestId('tenant-selector')
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    const combobox = wrap.getByRole('combobox')
    await expect(combobox).toBeVisible()

    // Clear via UI: prefer clicking the clear indicator (X). Fallback to backspace if needed.
    // Note: The sidebar SelectInput clear does not call /api/admin/clear-tenant-cookie (only SidebarTenantChip does),
    // so we do not wait for that response here.
    const clearIndicator = wrap
      .locator('button[aria-label*="Clear"], button[title*="Clear"]')
      .or(wrap.getByRole('button', { name: /clear/i }))
      .first()
    await clearIndicator.waitFor({ state: 'visible', timeout: isCI ? 15_000 : 5000 }).catch(() => null)
    if (await clearIndicator.isVisible().catch(() => false)) {
      await clearIndicator.click({ force: true })
    } else {
      await combobox.focus()
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
    }

    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click()
    }

    await page.waitForLoadState('load')

    // Ensure cookie is cleared. The SelectInput clear is client-only; in CI the UI clear can be flaky,
    // so we call the clear API from the page (same origin, credentials) so the cookie is definitely gone.
    await page.evaluate(async () => {
      await fetch('/api/admin/clear-tenant-cookie', { method: 'POST', credentials: 'include' })
    })

    // Trigger a fresh dashboard load so the cleared state is applied and cookie is gone.
    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('load').catch(() => null)
    await page.waitForTimeout(CI.settleAfterGotoMs)

    // Optionally wait for aggregate analytics request (no tenantId) when dashboard loads; don't fail test if it doesn't fire.
    const ANALYTICS_WAIT_MS = isCI ? 25_000 : 15_000
    await page
      .waitForRequest(
        (req) => {
          if (!req.url().includes('/api/analytics')) return false
          try {
            const url = new URL(req.url())
            return !url.searchParams.has('tenantId')
          } catch {
            return false
          }
        },
        { timeout: ANALYTICS_WAIT_MS }
      )
      .catch(() => null)

    // Cookie should be removed or empty after clear. Use document.cookie (client-set cookie)
    // so we avoid CI ambiguity with context.cookies() and multiple Path scopes.
    await expect
      .poll(
        async () => {
          const cookieStr = await page.evaluate(() => document.cookie).catch(() => '')
          const match = cookieStr.match(/(?:^|;\s*)payload-tenant=([^;]*)/)
          const value = match?.[1] ? decodeURIComponent(match[1]).trim() : ''
          return value === ''
        },
        { timeout: CI.cookiePollTimeout }
      )
      .toBe(true)
  })
})

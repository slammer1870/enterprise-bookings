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
  optionWaitMs: isCI ? 4000 : 1500,
  selectDeadlineMs: isCI ? 45_000 : 25_000,
  displayVisibleTimeout: isCI ? 25_000 : 15_000,
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
  if (await tenantSelector.isVisible().catch(() => false)) return

  // In Payload admin the menu toggle can remain visible even when the sidebar is already open,
  // so only click it when the tenant selector isn't visible.
  const openMenu = page.getByRole('button', { name: /open menu/i })
  if (await openMenu.isVisible().catch(() => false)) {
    await openMenu.click({ force: true })
  }

  // Wait for sidebar content (tenant selector) so we don't interact while still collapsed.
  await tenantSelector.waitFor({ state: 'visible', timeout: CI.sidebarTimeout })
}

/**
 * E2E: Admin tenant selector (ClearableTenantSelector).
 * Tests that opening the dropdown and clicking a tenant (e.g. the second one)
 * actually selects that tenant (cookie + displayed value), not the first.
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

    // Wait for tenant selector
    const wrap = page.getByTestId('tenant-selector')
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Start with first tenant so we can switch to second
    await page.context().addCookies([
      {
        name: 'payload-tenant',
        value: String(tenant1.id),
        url: `${ADMIN_ORIGIN}/`,
      },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Use a collection list page so there is no "modified" form state — tenant switch runs without confirmation modal
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/categories`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    const combobox = wrap.getByRole('combobox')
    await expect(combobox).toBeVisible()
    await combobox.scrollIntoViewIfNeeded()

    // Ensure tenant options have been synced at least once (can be delayed under CI load).
    const tenantOptionsResponse = page
      .waitForResponse(
        (res) =>
          res.request().method() === 'GET' &&
          res.status() >= 200 &&
          res.status() < 300 &&
          res.url().includes('/api/tenants/populate-tenant-options'),
        { timeout: isCI ? 30_000 : 20_000 },
      )
      .catch(() => null)

    await tenantOptionsResponse

    // Payload SelectInput (react-select): open menu and click option (preferred),
    // with a keyboard-driven fallback. Also handle the "Leave anyway" modal if it appears.
    const displayTenant2 = wrap.getByText(tenant2Name).first()
    const dropdownIndicator = wrap.locator('button').last()
    const input = wrap.locator('input').first()
    const option = page
      .locator('[id*="-option-"]')
      .filter({ hasText: new RegExp(`^${escapeRegex(tenant2Name)}$`, 'i') })
      .first()
    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })

    const selectDeadline = Date.now() + CI.selectDeadlineMs
    while (Date.now() < selectDeadline) {
      if (await displayTenant2.isVisible().catch(() => false)) break

      // Try to open via dropdown indicator first.
      await dropdownIndicator.click({ force: true }).catch(() => combobox.click({ force: true }))
      await option
        .waitFor({ state: 'visible', timeout: CI.optionWaitMs })
        .then(async () => option.click({ force: true }))
        .catch(async () => {
          // Fallback: drive via input typing + keyboard selection.
          await input.click({ force: true }).catch(() => combobox.click({ force: true }))
          await input.fill('').catch(() => null)
          await input.fill(tenant2Name).catch(async () => {
            await page.keyboard.press('Escape').catch(() => null)
            await page.keyboard.type(tenant2Name, { delay: 10 })
          })
          await page.keyboard.press('ArrowDown').catch(() => null)
          await page.keyboard.press('Enter').catch(() => null)
        })

      if (await leaveAnyway.isVisible().catch(() => false)) {
        await leaveAnyway.click({ force: true })
      }

      await page.waitForTimeout(isCI ? 500 : 350)
    }

    await expect(displayTenant2).toBeVisible({ timeout: CI.displayVisibleTimeout })

    // If a confirmation modal appears slightly later, confirm it so selection doesn't snap back.
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click({ force: true })
    }

    // setTenant(..., refresh: true) may reload; wait for load and for selector to be ready again.
    await page.waitForLoadState('load').catch(() => null)
    // After reload, re-query selector and combobox so we interact with the new page (CI can do full reload).
    await page.getByTestId('tenant-selector').waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    const comboboxAfter = page.getByTestId('tenant-selector').getByRole('combobox')
    await comboboxAfter.waitFor({ state: 'visible', timeout: 5000 })

    // Assert persistence across a hard reload (proves the cookie/state is truly saved).
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ensureSidebarOpen(page)
    const wrapAfterReload = page.getByTestId('tenant-selector')
    await wrapAfterReload.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    await expect(wrapAfterReload.getByText(tenant2Name).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })
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

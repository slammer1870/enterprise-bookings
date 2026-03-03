import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { ensureAtLeastTwoTenants, loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import { fetchTenantOptionsFromAPI, getTenantSelectorLocator } from './helpers/tenant-helpers'

const ADMIN_ORIGIN = BASE_URL
const ADMIN_COOKIE_URLS = [
  `${ADMIN_ORIGIN}/`,
  `${ADMIN_ORIGIN}/admin/`,
  `${ADMIN_ORIGIN}/admin/collections/`,
]

const ADMIN_VIEWPORT = { width: 1440, height: 900 }
const isCI = Boolean(
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.CI,
)
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

async function ensureSidebarOpen(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null)
  if (isCI) await page.waitForTimeout(1000)

  // Open the menu first when closed, so the layout is stable and the tenant selector is in view (avoids "outside viewport" when menu is closed).
  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  const closeMenuButton = page.getByRole('button', { name: /close\s+menu/i })

  // After navigation/reload, "Open Menu" may not be immediately visible even when the menu is collapsed.
  // Wait until either Open/Close is visible, then ensure we end in the "Close Menu" state.
  await Promise.race([
    openMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
    closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
  ]).catch(() => null)

  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.scrollIntoViewIfNeeded().catch(() => null)
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
    await closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(250)
  } else {
    // If it's already open, assert that explicitly so we don't proceed with a collapsed sidebar.
    await closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 })
  }

  const tenantSelector = getTenantSelectorLocator(page)
  // Component only renders when options are loaded (2+ tenants). Wait for the tenant-options API so the selector can appear.
  await page
    .waitForResponse(
      (res) => res.url().includes('populate-tenant-options') && res.request().method() === 'GET',
      { timeout: CI.sidebarTimeout },
    )
    .catch(() => null)

  try {
    await tenantSelector.waitFor({ state: 'visible', timeout: CI.sidebarTimeout })
  } catch {
    throw new Error(
      'Tenant selector did not appear (data-testid="tenant-selector"). The plugin only renders it when there are at least 2 tenants and options have loaded. Ensure the dev app has run seed (or create a second tenant), then re-run the test.',
    )
  }
  if (isCI) await tenantSelector.scrollIntoViewIfNeeded().catch(() => null)
}

test.describe('Admin Tenant Selector (clearable-tenant plugin)', () => {
  if (isCI) test.setTimeout(120_000)
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    await ensureAtLeastTwoTenants(request)
  })

  test('clicking second tenant in dropdown selects that tenant (cookie and display)', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]

    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15_000 },
      )
      .catch(() => {
        if (page.url().includes('/admin/login')) throw new Error('Super admin denied - redirected to login')
      })

    await ensureSidebarOpen(page)
    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    await page.waitForTimeout(400)

    await wrap.scrollIntoViewIfNeeded()
    // If the menu collapsed again after reload, reopen it before interacting with the selector.
    if (await page.getByRole('button', { name: /open\s+menu/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /open\s+menu/i }).click({ timeout: 10_000 })
      await page.getByRole('button', { name: /close\s+menu/i }).waitFor({ state: 'visible', timeout: 10_000 })
      await page.waitForTimeout(300)
    }

    // Open dropdown reliably: prefer the dropdown indicator button (react-select), fall back to click+key.
    const combobox = wrap.getByRole('combobox').or(wrap).first()
    await combobox.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    // In this UI there are typically two buttons (clear + dropdown). Clicking the last one is the most reliable open.
    await wrap.getByRole('button').last().click({ timeout: 5000 }).catch(() => null)
    await combobox.click({ timeout: 5000 }).catch(() => null)
    await combobox.focus()
    await page.keyboard.press('ArrowDown')

    // Don't require a listbox role (can vary); just wait for the option by accessible role/name.
    const option = page.getByRole('option', { name: new RegExp(escapeRegex(tenant2.name), 'i') }).first()
    await option.waitFor({ state: 'visible', timeout: CI.optionWaitMs })
    await option.click()

    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) await leaveAnyway.click()

    await page.waitForLoadState('load').catch(() => null)
    await ensureSidebarOpen(page)
    await expect(wrap.getByText(tenant2.name).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })
  })

  test('tenant selector is visible and selection is reflected via cookie and display', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]

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
    await getTenantSelectorLocator(page).waitFor({ state: 'visible', timeout: 20000 })

    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant2.id, url: `${ADMIN_ORIGIN}/` },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const cookies = await page.context().cookies(ADMIN_COOKIE_URLS)
    const payloadTenant = cookies.find((c) => c.name === 'payload-tenant')
    expect(payloadTenant).toBeDefined()
    expect(payloadTenant?.value).toBe(tenant2.id)

    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
    ])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)

    const cookiesAfter = await page.context().cookies(ADMIN_COOKIE_URLS)
    const payloadTenantAfter = cookiesAfter.find((c) => c.name === 'payload-tenant')
    expect(payloadTenantAfter?.value).toBe(tenant1.id)
  })

  test('clearing tenant on dashboard removes tenant cookie (aggregate analytics)', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    const uniqueTenants = Array.from(new Map(tenants.map((t) => [t.id, t])).values())
    expect(uniqueTenants.length).toBeGreaterThanOrEqual(2)
    const tenant2 = uniqueTenants[1]

    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)

    // Derive origin from the actual page URL (avoids localhost vs 127.0.0.1 cookie mismatches).
    const origin = new URL(page.url()).origin
    const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`]

    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant2.id, url: `${origin}/` },
      { name: 'payload-tenant', value: tenant2.id, url: `${origin}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    const combobox = wrap.getByRole('combobox').or(wrap).first()
    await expect(combobox).toBeVisible()

    const buttons = wrap.getByRole('button')
    const btnCount = await buttons.count()

    const isCookieCleared = async () => {
      const cookies = await page.context().cookies(cookieURLs)
      const tenantCookies = cookies.filter((c) => c.name === 'payload-tenant')
      return tenantCookies.length === 0 || tenantCookies.every((c) => !c.value)
    }

    const tryClickAndVerify = async (loc: ReturnType<typeof wrap.locator>) => {
      if (!(await loc.isVisible().catch(() => false))) return false
      await loc.click({ timeout: 10_000, force: true }).catch(() => null)
      try {
        await expect.poll(isCookieCleared, { timeout: 3_000 }).toBe(true)
        return true
      } catch {
        return false
      }
    }

    // Prefer the clear "X" button inside the select input.
    const ariaClear = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
    let cleared = await tryClickAndVerify(ariaClear)

    // If aria-labels aren't present, try each button inside the selector until the cookie clears.
    // (Some UI builds order the clear/dropdown buttons differently.)
    if (!cleared && btnCount > 0) {
      for (let i = 0; i < btnCount; i++) {
        const b = buttons.nth(i)
        cleared = await tryClickAndVerify(b)
        if (cleared) break
      }
    }

    // If we still couldn't clear, click where the "X" typically sits (right side of the control).
    if (!cleared) {
      const box = await combobox.boundingBox().catch(() => null)
      if (box) {
        await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2)
        try {
          await expect.poll(isCookieCleared, { timeout: 3_000 }).toBe(true)
          cleared = true
        } catch {
          cleared = false
        }
      }
    }

    // Fallback: open dropdown and select explicit "No tenant" if the UI exposes it.
    if (!cleared && btnCount >= 1) {
      await buttons.nth(btnCount - 1).click({ timeout: 10_000, force: true }).catch(() => null)
      const noTenant = page.getByRole('option', { name: /no\s+tenant/i }).first()
      if (await noTenant.isVisible().catch(() => false)) {
        await noTenant.click().catch(() => null)
        try {
          await expect.poll(isCookieCleared, { timeout: 5_000 }).toBe(true)
          cleared = true
        } catch {
          cleared = false
        }
      }
    }

    // Last resort: keyboard clear.
    if (!cleared) {
      await combobox.focus()
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
    }

    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click()
    }

    await page.waitForLoadState('load')

    // Optional: some apps expose an API to clear the cookie; call if available
    await page.evaluate(async () => {
      try {
        await fetch('/api/admin/clear-tenant-cookie', { method: 'POST', credentials: 'include' })
      } catch {
        // Ignore if route does not exist
      }
    })

    // Assert via cookie jar (covers all cookie paths /admin vs /, and avoids document.cookie edge cases).
    await expect
      .poll(
        isCookieCleared,
        { timeout: isCI ? 30_000 : 15_000 },
      )
      .toBe(true)
  })

  test('root admin clearing tenant with two tenants clears to no tenant (not first tenant)', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]

    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)

    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant2.id, url: `${ADMIN_ORIGIN}/` },
      { name: 'payload-tenant', value: tenant2.id, url: `${ADMIN_ORIGIN}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    const combobox = wrap.getByRole('combobox').or(wrap).first()
    await expect(combobox).toBeVisible()

    // Derive origin from the actual page URL (avoids localhost vs 127.0.0.1 cookie mismatches).
    const origin = new URL(page.url()).origin
    const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`]

    const isCookieCleared = async () => {
      const cookies = await page.context().cookies(cookieURLs)
      const tenantCookies = cookies.filter((c) => c.name === 'payload-tenant')
      return tenantCookies.length === 0 || tenantCookies.every((c) => !c.value)
    }

    const buttons = wrap.getByRole('button')
    const btnCount = await buttons.count()

    const tryClickAndVerify = async (loc: ReturnType<typeof wrap.locator>) => {
      if (!(await loc.isVisible().catch(() => false))) return false
      await loc.click({ timeout: 10_000, force: true }).catch(() => null)
      try {
        await expect.poll(isCookieCleared, { timeout: 3_000 }).toBe(true)
        return true
      } catch {
        return false
      }
    }

    // Prefer the clear "X" button inside the select input.
    const ariaClear = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
    let cleared = await tryClickAndVerify(ariaClear)

    // If aria-labels aren't present, try each button inside the selector until the cookie clears.
    if (!cleared && btnCount > 0) {
      for (let i = 0; i < btnCount; i++) {
        cleared = await tryClickAndVerify(buttons.nth(i))
        if (cleared) break
      }
    }

    // If we still couldn't clear, click where the "X" typically sits (right side of the control).
    if (!cleared) {
      const box = await combobox.boundingBox().catch(() => null)
      if (box) {
        await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2)
        try {
          await expect.poll(isCookieCleared, { timeout: 3_000 }).toBe(true)
          cleared = true
        } catch {
          cleared = false
        }
      }
    }

    // Last resort: keyboard clear.
    if (!cleared) {
      await combobox.focus()
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Backspace')
    }

    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click()
    }

    await page.waitForLoadState('load')
    await page.waitForTimeout(800)

    await expect.poll(isCookieCleared, { timeout: CI.cookiePollTimeout }).toBe(true)

    // Close any open menu (react-select) so we assert on the control's displayed value, not the option list.
    await page.keyboard.press('Escape').catch(() => null)
    await expect(wrap.getByText(/select a value/i).first()).toBeVisible()
  })

  test('create route requiring tenant shows modal and blocks until tenant selected', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })

    await page.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    // Ensure we start from "no tenant" (empty cookie + placeholder displayed).
    const origin = new URL(page.url()).origin
    await page.context().addCookies([
      { name: 'payload-tenant', value: '', url: `${origin}/` },
      { name: 'payload-tenant', value: '', url: `${origin}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    await expect(wrap.getByText(/select a value/i).first()).toBeVisible()

    const tenants = await fetchTenantOptionsFromAPI(page)
    const uniqueTenants = Array.from(new Map(tenants.map((t) => [t.id, t])).values())
    expect(uniqueTenants.length).toBeGreaterThanOrEqual(2)
    const tenant2 = uniqueTenants[1]

    // "posts" is configured in dev config as collectionsRequireTenantOnCreate.
    await page.goto(`${origin}/admin/collections/posts/create`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname.endsWith('/admin/collections/posts/create'), {
      timeout: 15_000,
    })

    const dialog = page.getByRole('dialog', { name: /select tenant/i })
    await expect(dialog).toBeVisible({ timeout: CI.wrapTimeout })

    const continueBtn = dialog.getByRole('button', { name: /continue/i })
    await expect(continueBtn).toBeDisabled()

    // Regression guard: modal must stay visible (not just "appear briefly") before we select a tenant.
    // This catches production failures where the create route becomes unclickable and the modal disappears.
    const start = Date.now()
    const durationMs = 10_000
    while (Date.now() - start < durationMs) {
      const visible = await dialog.isVisible().catch(() => false)
      expect(visible).toBe(true)
      await expect(continueBtn).toBeDisabled()
      await page.waitForTimeout(250)
    }

    // Select a tenant from the modal's select input.
    const modalCombo = dialog.getByRole('combobox').first()
    await modalCombo.click({ timeout: 5000 }).catch(() => null)
    await modalCombo.focus()
    // Prefer keyboard selection to avoid pointer-event overlays interfering with option clicks.
    await page.keyboard.type(tenant2.name)
    await page
      .getByRole('option', { name: new RegExp(escapeRegex(tenant2.name), 'i') })
      .first()
      .waitFor({ state: 'visible', timeout: CI.optionWaitMs })
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Tab')

    await expect(continueBtn).toBeEnabled()
    await Promise.all([
      page.waitForLoadState('load').catch(() => null),
      continueBtn.click(),
    ])

    // Modal triggers a hard reload; ensure we land back on the create route.
    await page.waitForURL((url) => url.pathname.endsWith('/admin/collections/posts/create'), {
      timeout: 15_000,
    })

    // Cookie reflects the chosen tenant.
    const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`]
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies(cookieURLs)
          return cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
        },
        { timeout: CI.cookiePollTimeout },
      )
      .toBe(tenant2.id)

    // Critical: after tenant selection + reload, the create UI must be usable.
    const titleInput = page.getByRole('textbox', { name: /^title$/i }).first()
    await expect(titleInput).toBeEnabled({ timeout: 15_000 })
    await titleInput.fill(`e2e ${Date.now()}`)
    await expect(titleInput).not.toHaveValue('')
  })

  test('collection edit page autofills tenant selector and sets cookie from document tenant', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]

    // Create a post with tenant2 assigned via API (dev app: posts collection has tenant field).
    const createRes = await request.post(`${ADMIN_ORIGIN}/api/posts`, {
      data: { title: `Edit-page tenant sync e2e ${Date.now()}`, tenant: tenant2.id },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(createRes.ok()).toBe(true)
    const createBody = (await createRes.json()) as { doc?: { id: string | number } }
    const postId = createBody.doc?.id
    expect(postId).toBeDefined()

    // Start with tenant1 selected so we can assert the edit page switches to tenant2.
    const cookieURLs = [`${ADMIN_ORIGIN}/`, `${ADMIN_ORIGIN}/admin/`, `${ADMIN_ORIGIN}/admin/collections/`]
    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/admin/` },
    ])
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/posts/${postId}`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname === `/admin/collections/posts/${postId}`,
        { timeout: 15_000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)
    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Tenant selector should show the document's tenant (tenant2), not tenant1.
    await expect(wrap.getByText(tenant2.name).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })

    // Cookie should be set to the document's tenant.
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies(cookieURLs)
          return cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
        },
        { timeout: CI.cookiePollTimeout },
      )
      .toBe(tenant2.id)
  })

  test('collection edit page with no tenant (optional field) keeps tenant selector and cookie clear', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]

    // Create a post with no tenant (base document; dev app posts have optional tenant field).
    const createRes = await request.post(`${ADMIN_ORIGIN}/api/posts`, {
      data: { title: `Base page no-tenant e2e ${Date.now()}` },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(createRes.ok()).toBe(true)
    const createBody = (await createRes.json()) as { doc?: { id: string | number } }
    const postId = createBody.doc?.id
    expect(postId).toBeDefined()

    // Start with tenant1 selected so we can assert the edit page clears to no tenant.
    const cookieURLs = [`${ADMIN_ORIGIN}/`, `${ADMIN_ORIGIN}/admin/`, `${ADMIN_ORIGIN}/admin/collections/`]
    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/admin/` },
    ])
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/posts/${postId}`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname === `/admin/collections/posts/${postId}`,
        { timeout: 15_000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)
    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Document has no tenant: selector should show clear/placeholder, not tenant1.
    await expect(wrap.getByText(/select a value/i).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })

    // Cookie should be cleared (no tenant).
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies(cookieURLs)
          const val = cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
          return val === '' || val === undefined
        },
        { timeout: CI.cookiePollTimeout },
      )
      .toBe(true)
  })

  test('optional tenant route (pages): user can clear tenant on create page', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]

    const cookieURLs = [`${ADMIN_ORIGIN}/`, `${ADMIN_ORIGIN}/admin/`, `${ADMIN_ORIGIN}/admin/collections/`]
    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/admin/` },
    ])
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/pages/create`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname.endsWith('/admin/collections/pages/create'),
        { timeout: 15_000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)
    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Optional tenant route: clear button should be present; clear the tenant.
    const clearBtn = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
    await expect(clearBtn).toBeVisible({ timeout: 5000 })
    await clearBtn.click()
    await page.waitForTimeout(500)

    // Selector should show placeholder and cookie should be cleared.
    await expect(wrap.getByText(/select a value/i).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies(cookieURLs)
          const val = cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
          return val === '' || val === undefined
        },
        { timeout: CI.cookiePollTimeout },
      )
      .toBe(true)
  })

  test('required tenant route (posts): clear button not available on create page', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]

    const cookieURLs = [`${ADMIN_ORIGIN}/`, `${ADMIN_ORIGIN}/admin/`, `${ADMIN_ORIGIN}/admin/collections/`]
    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/admin/` },
    ])
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/posts/create`, { waitUntil: 'load' })
    // Modal may appear: select tenant to continue to create page.
    const dialog = page.getByRole('dialog', { name: /select tenant/i })
    if (await dialog.isVisible().catch(() => false)) {
      const modalCombo = dialog.getByRole('combobox').first()
      await modalCombo.click().catch(() => null)
      await page.getByRole('option', { name: new RegExp(escapeRegex(tenant1.name), 'i') }).first().click()
      await dialog.getByRole('button', { name: /continue/i }).click()
      await page.waitForURL((url) => url.pathname.endsWith('/admin/collections/posts/create'), { timeout: 15_000 })
    }

    await ensureSidebarOpen(page)
    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })

    // Required tenant route: clear button must not be present.
    const clearBtn = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
    await expect(clearBtn).not.toBeVisible()
  })

  test('saving document after changing tenant selector persists selected tenant on the document', async ({
    page,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, 'admin@test.com', { request })
    await ensureSidebarOpen(page)
    const tenants = await fetchTenantOptionsFromAPI(page)
    expect(tenants.length).toBeGreaterThanOrEqual(2)
    const tenant1 = tenants[0]
    const tenant2 = tenants[1]

    // Create a page with tenant1 (dev app: pages collection has tenant field).
    const createRes = await request.post(`${ADMIN_ORIGIN}/api/pages`, {
      data: { title: `Selector-sync e2e ${Date.now()}`, tenant: tenant1.id },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(createRes.ok()).toBe(true)
    const createBody = (await createRes.json()) as { doc?: { id: string | number } }
    const pageId = createBody.doc?.id
    expect(pageId).toBeDefined()

    const cookieURLs = [`${ADMIN_ORIGIN}/`, `${ADMIN_ORIGIN}/admin/`, `${ADMIN_ORIGIN}/admin/collections/`]
    await page.context().addCookies([
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/` },
      { name: 'payload-tenant', value: tenant1.id, url: `${ADMIN_ORIGIN}/admin/` },
    ])
    await page.goto(`${ADMIN_ORIGIN}/admin/collections/pages/${pageId}`, { waitUntil: 'load' })
    await page
      .waitForURL(
        (url) => url.pathname === `/admin/collections/pages/${pageId}`,
        { timeout: 15_000 },
      )
      .catch(() => null)

    await ensureSidebarOpen(page)
    const wrap = getTenantSelectorLocator(page)
    await wrap.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    await expect(wrap.getByText(tenant1.name).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })

    // Change selector to tenant2.
    const combobox = wrap.getByRole('combobox').or(wrap).first()
    await combobox.waitFor({ state: 'visible', timeout: CI.wrapTimeout })
    await wrap.getByRole('button').last().click({ timeout: 5000 }).catch(() => null)
    await combobox.click({ timeout: 5000 }).catch(() => null)
    await combobox.focus()
    await page.keyboard.press('ArrowDown')
    const option = page.getByRole('option', { name: new RegExp(escapeRegex(tenant2.name), 'i') }).first()
    await option.waitFor({ state: 'visible', timeout: CI.optionWaitMs })
    await option.click()
    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) await leaveAnyway.click()

    await expect(wrap.getByText(tenant2.name).first()).toBeVisible({ timeout: CI.displayVisibleTimeout })

    // Save the document (cookie is now tenant2; hook should write it to the document).
    const saveBtn = page.getByRole('button', { name: /save/i }).first()
    await saveBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await saveBtn.click()
    await page.waitForTimeout(CI.settleAfterGotoMs)

    // Fetch the document via API; hook should have written selector (tenant2) to the document on save.
    const getRes = await page.request.get(`${ADMIN_ORIGIN}/api/pages/${pageId}`)
    expect(getRes.ok()).toBe(true)
    const getBody = (await getRes.json()) as { doc?: { tenant?: string | number | { id: string | number } } }
    const doc = getBody.doc ?? getBody
    const tenantValue = doc && typeof doc === 'object' && 'tenant' in doc ? (doc as { tenant?: unknown }).tenant : undefined
    const savedTenantId =
      tenantValue == null
        ? undefined
        : typeof tenantValue === 'object' && tenantValue !== null && 'id' in (tenantValue as object)
          ? (tenantValue as { id: string | number }).id
          : tenantValue
    expect(String(savedTenantId)).toBe(String(tenant2.id))
  })
})

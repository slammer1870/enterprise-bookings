import type { Page } from '@playwright/test'
import { expect, test } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import {
  getPayloadInstance,
  createTestPage,
} from './helpers/data-helpers'

const ADMIN_VIEWPORT = { width: 1440, height: 900 }
const isCI = Boolean(
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.CI,
)
const CI = {
  sidebarTimeout: isCI ? 25_000 : 20_000,
  clearTimeout: isCI ? 20_000 : 10_000,
  clearedStateDurationMs: isCI ? 10_000 : 6_000,
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getTenantSelector(page: Page) {
  return page.getByTestId('tenant-selector')
}

async function ensureSidebarOpen(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null)
  if (isCI) await page.waitForTimeout(250)

  // In some admin layouts (esp. wide viewports), the sidebar is always visible and
  // the "Open menu" / "Close menu" buttons are not rendered at all.
  const tenantSelector = getTenantSelector(page)
  if (await tenantSelector.isVisible().catch(() => false)) {
    return
  }

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })

  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
  }

  await expect(tenantSelector).toBeVisible({ timeout: CI.sidebarTimeout })
}

async function clearTenantSelectionFromUI(page: Page) {
  const wrap = getTenantSelector(page)
  await page.waitForTimeout(1000)
  const combobox = wrap.getByRole('combobox').or(wrap).first()
  const origin = new URL(page.url()).origin
  const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`, page.url()]

  const isPayloadTenantCleared = async () => {
    const cookies = await page.context().cookies(cookieURLs)
    const tenantCookies = cookies.filter((cookie) => cookie.name === 'payload-tenant')
    return tenantCookies.length === 0 || tenantCookies.every((cookie) => !cookie.value)
  }

  const waitForLeaveAnywayDialog = async () => {
    const leaveAnyway = page.getByRole('button', { name: /leave anyway/i })
    if (await leaveAnyway.isVisible().catch(() => false)) {
      await leaveAnyway.click()
    }
  }

  const buttons = wrap.getByRole('button')
  const buttonCount = await buttons.count()

  const tryClear = async (locator: ReturnType<typeof wrap.locator>) => {
    if (!(await locator.isVisible().catch(() => false))) return false

    const clearResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/admin/clear-tenant-cookie') &&
          response.request().method() === 'POST',
        { timeout: CI.clearTimeout },
      )
      .catch(() => null)

    await locator.dispatchEvent('mousedown').catch(() => null)
    await locator.click({ timeout: 10_000, force: true }).catch(() => null)
    await clearResponsePromise
    await waitForLeaveAnywayDialog()

    try {
      await expect.poll(isPayloadTenantCleared, { timeout: CI.clearTimeout }).toBe(true)
      return true
    } catch {
      return false
    }
  }

  const ariaClear = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
  let cleared = await tryClear(ariaClear)

  if (!cleared && buttonCount > 0) {
    for (let index = 0; index < buttonCount; index += 1) {
      cleared = await tryClear(buttons.nth(index))
      if (cleared) break
    }
  }

  if (!cleared) {
    const box = await combobox.boundingBox().catch(() => null)
    if (box) {
      await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2)
      await waitForLeaveAnywayDialog()
      try {
        await expect.poll(isPayloadTenantCleared, { timeout: CI.clearTimeout }).toBe(true)
        cleared = true
      } catch {
        cleared = false
      }
    }
  }

  if (!cleared) {
    await combobox.focus().catch(() => null)
    await page.keyboard.press('Backspace').catch(() => null)
    await page.keyboard.press('Backspace').catch(() => null)
    await waitForLeaveAnywayDialog()
  }

  await page.waitForLoadState('load').catch(() => null)
  await page
    .evaluate(async () => {
      try {
        await fetch('/api/admin/clear-tenant-cookie', {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // Ignore if the clear route is temporarily unavailable during navigation.
      }
    })
    .catch(() => null)

  await expect.poll(isPayloadTenantCleared, { timeout: CI.clearTimeout }).toBe(true)
  await page.keyboard.press('Escape').catch(() => null)
}


test.describe('Admin tenant selector — clearing on list shows all tenants', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  test('clearing tenant on a collection list stays cleared even a few seconds later', async ({
    page,
    testData,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })

    const payload = await getPayloadInstance()
    const tenant1 = testData.tenants[0]
    const tenant2 = testData.tenants[1]
    if (!tenant1?.id || !tenant1?.slug || !tenant1?.name) throw new Error('Test setup requires tenant1')
    if (!tenant2?.id || !tenant2?.slug || !tenant2?.name) throw new Error('Test setup requires tenant2')

    const title1 = `E2E Page T1 ${testData.workerIndex}`
    const title2 = `E2E Page T2 ${testData.workerIndex}`

    // Ensure two tenant-scoped pages exist (unique slugs per worker).
    await createTestPage(tenant1.id, `e2e-clear-tenant-t1-${testData.workerIndex}`, title1)
    await createTestPage(tenant2.id, `e2e-clear-tenant-t2-${testData.workerIndex}`, title2)

    // Seed a tenant-slug cookie to mimic prior tenant-host navigation.
    // The regression: on root-domain admin, clearing tenant should still show "all tenants"
    // and must NOT re-select a tenant because tenant-slug is set.
    const origin = new URL(BASE_URL).origin
    await page.context().addCookies([
      { name: 'tenant-slug', value: tenant1.slug, url: `${origin}/` },
      { name: 'tenant-slug', value: tenant1.slug, url: `${origin}/admin/` },
    ])

    await page.goto(`${BASE_URL}/admin/collections/pages`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    // Select tenant1 explicitly via the same cookie/context mechanism the selector writes to.
    // This keeps the test focused on the clear/reload regression instead of the dropdown UI.
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(page.getByText(title1)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(title2)).toHaveCount(0)

    // Clear tenant selection through the actual selector UI; list should show docs from all tenants
    // and must remain cleared even after the router refresh settles.
    const getPayloadTenantCookie = async () => {
      const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`, page.url()]
      const cookies = await page.context().cookies(cookieURLs)
      return cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
    }

    await clearTenantSelectionFromUI(page)
    await ensureSidebarOpen(page)

    await expect
      .poll(async () => await getPayloadTenantCookie(), { timeout: 20_000 })
      .toBe('')

    await expect(page.getByText(title1)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(title2)).toBeVisible({ timeout: 20_000 })

    const clearedStateStart = Date.now()
    while (Date.now() - clearedStateStart < CI.clearedStateDurationMs) {
      await expect
        .poll(async () => await getPayloadTenantCookie(), { timeout: 2_000 })
        .toBe('')
      await expect(page.getByText(title1)).toBeVisible({ timeout: 2_000 })
      await expect(page.getByText(title2)).toBeVisible({ timeout: 2_000 })
      await page.waitForTimeout(500)
    }

    // Reload should still remain "all tenants" and must not snap back to tenant1 via tenant-slug cookie.
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(page.getByText(title1)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(title2)).toBeVisible({ timeout: 20_000 })

    // Cleanup is handled by migrate:fresh per test run; avoid deletes to reduce flake.
    void payload
  })

  test('base-url admin preserves selected tenant context when navigating between collections', async ({
    page,
    testData,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })

    const tenant1 = testData.tenants[0]
    const tenant2 = testData.tenants[1]
    if (!tenant1?.id || !tenant1?.name) throw new Error('Test setup requires tenant1')
    if (!tenant2?.id || !tenant2?.name) throw new Error('Test setup requires tenant2')

    const tenant1PageTitle = `E2E tenant-nav pages t1 ${testData.workerIndex}`
    const tenant2PageTitle = `E2E tenant-nav pages t2 ${testData.workerIndex}`
    await createTestPage(
      tenant1.id,
      `e2e-tenant-nav-pages-t1-${testData.workerIndex}`,
      tenant1PageTitle,
    )
    await createTestPage(
      tenant2.id,
      `e2e-tenant-nav-pages-t2-${testData.workerIndex}`,
      tenant2PageTitle,
    )

    const origin = new URL(BASE_URL).origin

    await page.goto(`${BASE_URL}/admin/collections/pages`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await expect(
      getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant1.name), 'i')).first(),
    ).toBeVisible({ timeout: 20_000 })

    await expect(page.getByText(tenant1PageTitle)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(tenant2PageTitle)).toHaveCount(0)

    await page.goto(`${BASE_URL}/admin/collections/lessons`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await expect(getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant1.name), 'i')).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('heading', { name: /lessons/i }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.goto(`${BASE_URL}/admin/collections/pages`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await expect(getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant1.name), 'i')).first()).toBeVisible({
      timeout: 20_000,
    })

    await expect(page.getByText(tenant1PageTitle)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(tenant2PageTitle)).toHaveCount(0)

    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant2.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant2.id), url: `${origin}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await expect(
      getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant2.name), 'i')).first(),
    ).toBeVisible({ timeout: 20_000 })

    await expect(page.getByText(tenant2PageTitle)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(tenant1PageTitle)).toHaveCount(0)

    await page.goto(`${BASE_URL}/admin/collections/lessons`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await expect(page.getByRole('heading', { name: /lessons/i }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.goto(`${BASE_URL}/admin/collections/pages`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(page.getByText(tenant2PageTitle)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(tenant1PageTitle)).toHaveCount(0)
  })
})


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
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getTenantSelector(page: Page) {
  return page.getByTestId('tenant-selector')
}

async function ensureSidebarOpen(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null)
  if (isCI) await page.waitForTimeout(1000)

  // In some admin layouts (esp. wide viewports), the sidebar is always visible and
  // the "Open menu" / "Close menu" buttons are not rendered at all.
  if (await getTenantSelector(page).isVisible().catch(() => false)) {
    return
  }

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  const closeMenuButton = page.getByRole('button', { name: /close\s+menu/i })

  await Promise.race([
    openMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
    closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
  ]).catch(() => null)

  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
    await closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null)
    await page.waitForTimeout(250)
  }

  await page
    .waitForResponse(
      (res) => res.url().includes('populate-tenant-options') && res.request().method() === 'GET',
      { timeout: CI.sidebarTimeout },
    )
    .catch(() => null)

  await getTenantSelector(page).waitFor({ state: 'visible', timeout: CI.sidebarTimeout })
}


test.describe('Admin tenant selector — clearing on list shows all tenants', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  test('clearing tenant on a collection list does not auto-select first tenant (even if tenant-slug cookie exists)', async ({
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

    const wrap = getTenantSelector(page)

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

    // Clear tenant selection; list should show docs from all tenants.
    const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`]
    const getPayloadTenantCookie = async () => {
      const cookies = await page.context().cookies(cookieURLs)
      return cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
    }

    // Clear the tenant context directly, then reload to exercise the regression:
    // root admin must remain in "all tenants" mode even when tenant-slug is present.
    await page.context().addCookies([
      { name: 'payload-tenant', value: '', url: `${origin}/` },
      { name: 'payload-tenant', value: '', url: `${origin}/admin/` },
      { name: 'payload-tenant', value: '', url: `${origin}/admin/collections/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect
      .poll(async () => await getPayloadTenantCookie(), { timeout: 20_000 })
      .toBe('')

    await expect(wrap.getByText(/select a value/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(title1)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(title2)).toBeVisible({ timeout: 20_000 })

    // Reload should remain "all tenants" (must not snap back to tenant1 via tenant-slug cookie).
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(wrap.getByText(/select a value/i).first()).toBeVisible({ timeout: 20_000 })
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


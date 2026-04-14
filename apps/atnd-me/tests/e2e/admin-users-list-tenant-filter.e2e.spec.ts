import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin, BASE_URL } from './helpers/auth-helpers'
import { getPayloadInstance, createTestUser } from './helpers/data-helpers'
import {
  adminTenantSelectorCI,
  clearTenantSelectionFromUI,
  ensureSidebarOpen,
  escapeRegex,
  getTenantSelector,
} from './helpers/admin-tenant-selector-helpers'

const ADMIN_VIEWPORT = { width: 1440, height: 900 }

function usersEmailCell(page: Page, email: string) {
  return page
    .getByRole('table')
    .getByRole('cell', { name: new RegExp(`^${escapeRegex(email)}$`, 'i') })
}

test.describe('Admin users list — tenant selector filters rows for multi-tenant org admin', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  test('org admin with two tenants sees only users for the selected tenant', async ({
    page,
    testData,
    request,
  }) => {
    const tenant1 = testData.tenants[0]
    const tenant2 = testData.tenants[1]
    const user1 = testData.users.user1
    const user2 = testData.users.user2

    if (!tenant1?.id || !tenant1?.name) throw new Error('Test setup requires tenant1')
    if (!tenant2?.id || !tenant2?.name) throw new Error('Test setup requires tenant2')
    if (!user1?.email || !user2?.email) throw new Error('Test setup requires user1 and user2')

    const emailSuffix = testData.workerIndex > 0 ? `w${testData.workerIndex}` : ''
    const multiAdminEmail = `mtadmin${emailSuffix}@test.com`

    await createTestUser(multiAdminEmail, 'password', 'Multi-Tenant Admin', ['admin'], tenant1.id)

    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'users',
      where: { email: { equals: multiAdminEmail } },
      data: {
        tenants: [{ tenant: tenant1.id }, { tenant: tenant2.id }],
        registrationTenant: tenant1.id,
      },
      overrideAccess: true,
    })

    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsTenantAdmin(page, 1, multiAdminEmail, { request })

    const origin = new URL(BASE_URL).origin
    const usersListUrl = `${BASE_URL}/admin/collections/users?limit=100&sort=-updatedAt`

    await page.goto(usersListUrl, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/admin/` },
    ])
    await page.goto(usersListUrl, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(
      getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant1.name), 'i')).first(),
    ).toBeVisible({ timeout: 20_000 })

    await expect(usersEmailCell(page, user1.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user2.email)).toHaveCount(0)

    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant2.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant2.id), url: `${origin}/admin/` },
    ])
    await page.goto(usersListUrl, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(
      getTenantSelector(page).getByText(new RegExp(escapeRegex(tenant2.name), 'i')).first(),
    ).toBeVisible({ timeout: 20_000 })

    await expect(usersEmailCell(page, user2.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user1.email)).toHaveCount(0)
  })

  test('on root-domain admin, clearing tenant shows users from all org-admin tenants (not other sites)', async ({
    page,
    testData,
    request,
  }) => {
    const tenant1 = testData.tenants[0]
    const tenant2 = testData.tenants[1]
    const user1 = testData.users.user1
    const user2 = testData.users.user2
    const user3 = testData.users.user3

    if (!tenant1?.id || !tenant1?.slug || !tenant1?.name) throw new Error('Test setup requires tenant1')
    if (!tenant2?.id || !tenant2?.name) throw new Error('Test setup requires tenant2')
    if (!user1?.email || !user2?.email || !user3?.email) {
      throw new Error('Test setup requires user1, user2, and user3')
    }

    const emailSuffix = testData.workerIndex > 0 ? `w${testData.workerIndex}` : ''
    const multiAdminEmail = `mtadmin${emailSuffix}@test.com`

    await createTestUser(multiAdminEmail, 'password', 'Multi-Tenant Admin', ['admin'], tenant1.id)

    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'users',
      where: { email: { equals: multiAdminEmail } },
      data: {
        tenants: [{ tenant: tenant1.id }, { tenant: tenant2.id }],
        registrationTenant: tenant1.id,
      },
      overrideAccess: true,
    })

    await page.setViewportSize(ADMIN_VIEWPORT)
    // Root host (e.g. atnd.me / localhost), not tenant subdomain — session matches production base-domain admin.
    await loginAsTenantAdmin(page, 1, multiAdminEmail, { request })

    const origin = new URL(BASE_URL).origin
    const usersListUrl = `${BASE_URL}/admin/collections/users?limit=100&sort=-updatedAt`

    await page.context().addCookies([
      { name: 'tenant-slug', value: tenant1.slug, url: `${origin}/` },
      { name: 'tenant-slug', value: tenant1.slug, url: `${origin}/admin/` },
    ])

    await page.goto(usersListUrl, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await page.context().addCookies([
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/` },
      { name: 'payload-tenant', value: String(tenant1.id), url: `${origin}/admin/` },
    ])
    await page.goto(usersListUrl, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(usersEmailCell(page, user1.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user2.email)).toHaveCount(0)

    const getPayloadTenantCookie = async () => {
      const cookieURLs = [`${origin}/`, `${origin}/admin/`, `${origin}/admin/collections/`, page.url()]
      const cookies = await page.context().cookies(cookieURLs)
      return cookies.find((c) => c.name === 'payload-tenant')?.value ?? ''
    }

    await clearTenantSelectionFromUI(page)
    await ensureSidebarOpen(page)

    await expect.poll(async () => await getPayloadTenantCookie(), { timeout: 20_000 }).toBe('')

    await page.goto(usersListUrl, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(usersEmailCell(page, user1.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user2.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user3.email)).toHaveCount(0)

    const clearedStateStart = Date.now()
    while (Date.now() - clearedStateStart < adminTenantSelectorCI.clearedStateDurationMs) {
      await expect.poll(async () => await getPayloadTenantCookie(), { timeout: 2_000 }).toBe('')
      await expect(usersEmailCell(page, user1.email).first()).toBeVisible({ timeout: 2_000 })
      await expect(usersEmailCell(page, user2.email).first()).toBeVisible({ timeout: 2_000 })
      await page.waitForTimeout(500)
    }

    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    await expect(usersEmailCell(page, user1.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user2.email).first()).toBeVisible({ timeout: 20_000 })
    await expect(usersEmailCell(page, user3.email)).toHaveCount(0)
  })
})

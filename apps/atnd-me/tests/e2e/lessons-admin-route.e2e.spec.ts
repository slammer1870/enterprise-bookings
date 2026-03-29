/**
 * Phase 5: Lessons admin route (admin/collections/lessons) smoke test.
 * Ensures the custom list view loads and key UI is present after replacing shadcn with payloadcms/ui.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import { BASE_URL } from './helpers/auth-helpers'

test.describe('Lessons admin route (admin/collections/lessons)', () => {
  test('super admin sees Lessons list view with heading and Create New', async ({
    page,
    testData,
    request,
  }) => {
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/lessons`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL((url) => url.pathname === '/admin/collections/lessons', { timeout: 15000 })
      .catch(() => {})

    expect(page.url()).toContain('/admin/collections/lessons')

    await expect(page.getByRole('heading', { name: /lessons/i }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(
      page.getByRole('link', { name: /create new/i }).or(page.getByRole('button', { name: /create new/i })).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('tenant-admin sees Lessons list view for their tenant', async ({
    page,
    testData,
    request,
  }) => {
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/lessons`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL((url) => url.pathname === '/admin/collections/lessons', { timeout: 15000 })
      .catch(() => {})

    expect(page.url()).toContain('/admin/collections/lessons')

    await expect(page.getByRole('heading', { name: /lessons/i }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(
      page.getByRole('link', { name: /create new/i }).or(page.getByRole('button', { name: /create new/i })).first()
    ).toBeVisible({ timeout: 5000 })

    // List view: table or empty/loading message
    await expect(
      page.getByText(/no classes for today|start time|loading lessons/i).first()
    ).toBeVisible({ timeout: 10000 })
  })
})

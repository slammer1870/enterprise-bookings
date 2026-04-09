/**
 * Phase 5: Timeslots admin route (admin/collections/timeslots) smoke test.
 * Ensures the custom list view loads and key UI is present after replacing shadcn with payloadcms/ui.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import { BASE_URL } from './helpers/auth-helpers'

test.describe('Timeslots admin route (admin/collections/timeslots)', () => {
  test('super admin sees Timeslots list view with heading and Create New', async ({
    page,
    testData,
    request,
  }) => {
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/timeslots`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL((url) => url.pathname === '/admin/collections/timeslots', { timeout: 15000 })
      .catch(() => {})

    expect(page.url()).toContain('/admin/collections/timeslots')

    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(
      page.getByRole('link', { name: /create new/i }).or(page.getByRole('button', { name: /create new/i })).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('tenant-admin sees Timeslots list view for their tenant', async ({
    page,
    testData,
    request,
  }) => {
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/timeslots`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL((url) => url.pathname === '/admin/collections/timeslots', { timeout: 15000 })
      .catch(() => {})

    expect(page.url()).toContain('/admin/collections/timeslots')

    await expect(page.getByRole('heading', { name: /timeslots/i }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(
      page.getByRole('link', { name: /create new/i }).or(page.getByRole('button', { name: /create new/i })).first()
    ).toBeVisible({ timeout: 5000 })

    // List view: empty state, loading, or table (avoid matching hidden "Start Time" field labels)
    await expect(
      page
        .getByText(/no classes for (today|selected date)|loading timeslots/i)
        .first()
        .or(page.getByRole('columnheader', { name: /^Start Time$/i }))
    ).toBeVisible({ timeout: 10000 })
  })
})

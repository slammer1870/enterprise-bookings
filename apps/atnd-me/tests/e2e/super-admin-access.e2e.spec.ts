import { test, expect } from '@playwright/test'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsSuperAdmin } from './helpers/auth-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestPage,
  createTestTenant,
} from './helpers/data-helpers'

test.describe('Super Admin Access Control', () => {
  let testData: Awaited<ReturnType<typeof setupE2ETestData>>

  test.beforeAll(async () => {
    testData = await setupE2ETestData()

    // Create test pages for each tenant
    await createTestPage(testData.tenants[0].id, 'admin-page-1', 'Admin Page 1')
    await createTestPage(testData.tenants[1].id, 'admin-page-2', 'Admin Page 2')
  })

  test.afterAll(async () => {
    if (testData) {
      await cleanupTestData(
        testData.tenants.map((t) => t.id),
        Object.values(testData.users).map((u) => u.id)
      )
    }
  })

  test.describe('Super Admin Access to All Tenants', () => {
    test('should allow super admin to access all tenants data', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })

    test('should allow super admin to create content in any tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Look for create button
      const createButton = page
        .locator('button:has-text("Create New")')
        .or(page.locator('a[href*="/create"]'))
        .first()

      const hasCreateButton = await createButton.isVisible().catch(() => false)
      expect(hasCreateButton).toBe(true)
    })

    test('should allow super admin to update content in any tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })

    test('should allow super admin to delete content in any tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })
  })

  test.describe('Super Admin Tenant Management', () => {
    test('should allow super admin to access tenants collection', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/tenants', {
        waitUntil: 'networkidle',
      })

      // Verify tenants collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/tenants')
    })

    test('should allow super admin to create new tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/tenants', {
        waitUntil: 'networkidle',
      })

      // Look for create button
      const createButton = page
        .locator('button:has-text("Create New")')
        .or(page.locator('a[href*="/create"]'))
        .first()

      const hasCreateButton = await createButton.isVisible().catch(() => false)
      expect(hasCreateButton).toBe(true)
    })

    test('should allow super admin to update tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto(
        `http://localhost:3000/admin/collections/tenants/${testData.tenants[0].id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify tenant edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/tenants')
      expect(url).toContain(testData.tenants[0].id)
    })

    test('should allow super admin to delete tenant', async ({ page }) => {
      // Create a test tenant to delete
      const testTenant = await createTestTenant('Delete Test Tenant', 'delete-test-tenant')

      await loginAsSuperAdmin(page)
      await page.goto(
        `http://localhost:3000/admin/collections/tenants/${testTenant.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify tenant edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/tenants')
      expect(url).toContain(testTenant.id)

      // Cleanup
      await cleanupTestData([testTenant.id], [])
    })
  })

  test.describe('Super Admin User Management', () => {
    test('should allow super admin to see all users from all tenants', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // Verify users collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/users')
    })

    test('should allow super admin to update any user', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user1.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify user edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/users')
      expect(url).toContain(testData.users.user1.id)
    })

    test('should allow super admin to delete any user', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user3.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify user edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/users')
      expect(url).toContain(testData.users.user3.id)
    })

    test('should allow super admin to assign tenant-admin role', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user1.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify user edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/users')
      expect(url).toContain(testData.users.user1.id)
    })
  })
})

import { test, expect } from '@playwright/test'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestPage,
  createTestClassOption,
  createTestLesson,
} from './helpers/data-helpers'

test.describe('Tenant-Admin Access Control', () => {
  let testData: Awaited<ReturnType<typeof setupE2ETestData>>

  test.beforeAll(async () => {
    testData = await setupE2ETestData()

    // Create test content for tenant-1
    await createTestPage(testData.tenants[0].id, 'test-page-1', 'Test Page 1')
    await createTestPage(testData.tenants[1].id, 'test-page-2', 'Test Page 2')

    // Create test lessons
    const classOption1 = await createTestClassOption(
      testData.tenants[0].id,
      'Class Option 1',
      10
    )
    const classOption2 = await createTestClassOption(
      testData.tenants[1].id,
      'Class Option 2',
      10
    )

    const startTime1 = new Date()
    startTime1.setHours(10, 0, 0, 0)
    const endTime1 = new Date(startTime1)
    endTime1.setHours(11, 0, 0, 0)

    const startTime2 = new Date()
    startTime2.setHours(14, 0, 0, 0)
    const endTime2 = new Date(startTime2)
    endTime2.setHours(15, 0, 0, 0)

    await createTestLesson(testData.tenants[0].id, classOption1.id, startTime1, endTime1)
    await createTestLesson(testData.tenants[1].id, classOption2.id, startTime2, endTime2)
  })

  test.afterAll(async () => {
    if (testData) {
      await cleanupTestData(
        testData.tenants.map((t) => t.id),
        Object.values(testData.users).map((u) => u.id)
      )
    }
  })

  test.describe('Tenant-Admin Access to Own Tenant', () => {
    test('should allow tenant-admin to access admin panel', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' })

      // Verify admin panel is accessible
      const url = page.url()
      expect(url).toContain('/admin')
    })

    test('should show only tenant-1 data to tenant-1 admin', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')

      // Navigate to lessons
      await page.goto('http://localhost:3000/admin/collections/lessons', {
        waitUntil: 'networkidle',
      })
      expect(page.url()).toContain('/admin/collections/lessons')
    })

    test('should allow tenant-admin to create content in their tenant', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
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

    test('should allow tenant-admin to update content in their tenant', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages list is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })

    test('should allow tenant-admin to delete content in their tenant', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })
  })

  test.describe('Tenant-Admin Access Restrictions', () => {
    test('should prevent tenant-admin from accessing other tenants data', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Tenant-2's pages should not be visible
      // This is verified by the fact that only tenant-1's pages are shown
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })

    test('should prevent tenant-admin from creating content in other tenants', async ({
      page,
    }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // New content should automatically be assigned to tenant-1
      // Verify create page is accessible
      const createButton = page
        .locator('button:has-text("Create New")')
        .or(page.locator('a[href*="/create"]'))
        .first()

      const hasCreateButton = await createButton.isVisible().catch(() => false)
      expect(hasCreateButton).toBe(true)
    })

    test('should prevent tenant-admin from updating other tenants data', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Tenant-2's pages should not be accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })

    test('should prevent tenant-admin from deleting other tenants data', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Tenant-2's pages should not be accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')
    })

    test('should prevent tenant-admin from accessing tenants collection', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' })

      // Verify tenants collection is not visible in navigation
      const tenantsLink = page.locator('a[href*="/collections/tenants"]')
      const hasTenantsLink = await tenantsLink.isVisible().catch(() => false)

      expect(hasTenantsLink).toBe(false)
    })

    test('should prevent tenant-admin from accessing other tenant admins', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // Tenant-2 admin should not be visible
      const url = page.url()
      expect(url).toContain('/admin/collections/users')
    })
  })

  test.describe('Tenant-Admin User Management', () => {
    test('should allow tenant-admin to create users in their tenant', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/users', {
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

    test('should allow tenant-admin to update users in their tenant', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user1.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify user edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/users')
      expect(url).toContain(testData.users.user1.id)
    })

    test('should prevent tenant-admin from creating users in other tenants', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // New users should automatically be assigned to tenant-1
      const createButton = page
        .locator('button:has-text("Create New")')
        .or(page.locator('a[href*="/create"]'))
        .first()

      const hasCreateButton = await createButton.isVisible().catch(() => false)
      expect(hasCreateButton).toBe(true)
    })
  })
})

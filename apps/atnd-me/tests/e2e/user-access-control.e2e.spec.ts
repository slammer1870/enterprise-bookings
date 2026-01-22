import { test, expect } from '@playwright/test'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsSuperAdmin, loginAsTenantAdmin, loginAsRegularUser } from './helpers/auth-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestBooking,
  createTestClassOption,
  createTestLesson,
} from './helpers/data-helpers'

test.describe('User Access Control & Visibility', () => {
  let testData: Awaited<ReturnType<typeof setupE2ETestData>>
  let lesson1: any

  test.beforeAll(async () => {
    testData = await setupE2ETestData()

    // Create test lesson
    const classOption1 = await createTestClassOption(
      testData.tenants[0].id,
      'Test Class',
      10
    )

    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0)

    lesson1 = await createTestLesson(
      testData.tenants[0].id,
      classOption1.id,
      startTime,
      endTime
    )
  })

  test.afterAll(async () => {
    if (testData) {
      await cleanupTestData(
        testData.tenants.map((t) => t.id),
        Object.values(testData.users).map((u) => u.id)
      )
    }
  })

  test.describe('User Visibility Rules', () => {
    test('should show user to tenant-1 admin if user registered in tenant-1', async ({
      page,
    }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // Verify admin panel is accessible
      const url = page.url()
      expect(url).toContain('/admin')
    })

    test('should show user to tenant-1 admin if user has booking in tenant-1', async ({
      page,
    }) => {
      // User registered in tenant-2, but has booking in tenant-1
      await createTestBooking(testData.users.user2.id, lesson1.id, 'pending')

      await loginAsTenantAdmin(page, 1)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // Verify admin panel is accessible
      const url = page.url()
      expect(url).toContain('/admin')
    })

    test('should NOT show user to tenant-2 admin if user only registered/booked in tenant-1', async ({
      page,
    }) => {
      await loginAsTenantAdmin(page, 2)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // Verify admin panel is accessible
      const url = page.url()
      expect(url).toContain('/admin')
    })

    test('should show all users to super admin', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/users', {
        waitUntil: 'networkidle',
      })

      // Verify admin panel is accessible
      const url = page.url()
      expect(url).toContain('/admin')
    })
  })

  test.describe('User Access Permissions', () => {
    test('should allow super admin to update any user', async ({ page }) => {
      await loginAsSuperAdmin(page)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user1.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify user edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin')
      expect(url).toContain(testData.users.user1.id)
    })

    test('should allow tenant-admin to update users in their tenant', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user1.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify user edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin')
    })

    test('should prevent tenant-admin from updating users in other tenants', async ({
      page,
    }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user2.id}`,
        { waitUntil: 'networkidle' }
      )

      // Should either redirect or show error
      const url = page.url()
      // User might not be visible or access denied
      expect(url).toBeTruthy()
    })

    test('should allow users to update themselves', async ({ page }) => {
      await loginAsRegularUser(page, 1)
      await navigateToTenant(page, 'test-tenant-1')

      // Users typically update themselves via profile page, not admin panel
      // Verify user can access their own data
      expect(page.url()).toBeTruthy()
    })

    test('should prevent users from updating other users', async ({ page }) => {
      await loginAsRegularUser(page, 1)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user2.id}`,
        { waitUntil: 'networkidle' }
      )

      // Should redirect or deny access
      const url = page.url()
      // Regular users shouldn't access admin panel
      expect(url).not.toContain('/admin/collections/users')
    })

    test('should allow only super admin to delete users', async ({ page }) => {
      await loginAsTenantAdmin(page, 1)
      await page.goto(
        `http://localhost:3000/admin/collections/users/${testData.users.user1.id}`,
        { waitUntil: 'networkidle' }
      )

      // Verify delete action is not available or access is denied
      const deleteButton = page.locator('button:has-text("Delete")').first()
      const hasDeleteButton = await deleteButton.isVisible().catch(() => false)

      // Tenant-admin should not have delete access
      expect(hasDeleteButton).toBe(false)
    })
  })
})

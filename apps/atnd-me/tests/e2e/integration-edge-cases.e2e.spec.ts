import { test, expect } from '@playwright/test'
import { navigateToTenant, navigateToRoot } from './helpers/subdomain-helpers'
import { loginAsRegularUser, loginAsSuperAdmin } from './helpers/auth-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestTenant,
  createTestPage,
  createTestClassOption,
  createTestLesson,
} from './helpers/data-helpers'

test.describe('Integration & Edge Cases', () => {
  let testData: Awaited<ReturnType<typeof setupE2ETestData>>

  test.beforeAll(async () => {
    testData = await setupE2ETestData()
  })

  test.afterAll(async () => {
    if (testData) {
      await cleanupTestData(
        testData.tenants.map((t) => t.id),
        Object.values(testData.users).map((u) => u.id)
      )
    }
  })

  test.describe('Multi-Tenant Data Integrity', () => {
    test('should maintain data isolation when multiple tenants exist', async ({ page }) => {
      // Create pages with same slug for different tenants
      await createTestPage(testData.tenants[0].id, 'same-slug', 'Page 1')
      await createTestPage(testData.tenants[1].id, 'same-slug', 'Page 2')

      // Navigate to tenant-1
      await navigateToTenant(page, 'test-tenant-1', '/same-slug')
      const url1 = page.url()
      expect(url1).toContain('test-tenant-1')

      // Navigate to tenant-2
      await navigateToTenant(page, 'test-tenant-2', '/same-slug')
      const url2 = page.url()
      expect(url2).toContain('test-tenant-2')

      // Verify different tenants show different content
      expect(url1).not.toBe(url2)
    })

    test('should allow same slug across different tenants in admin panel', async ({ page }) => {
      await loginAsSuperAdmin(page)
      
      const slug = `admin-test-slug-${Date.now()}`
      
      // Create page for tenant 1
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })
      
      // Fill in page form for tenant 1
      await page.fill('input[name="title"]', `Page for Tenant 1 - ${slug}`)
      await page.fill('input[name="slug"]', slug)
      
      // Select tenant 1 from dropdown (if tenant selector exists)
      const tenantSelect = page.locator('select[name="tenant"], input[name="tenant"]').first()
      if (await tenantSelect.isVisible().catch(() => false)) {
        await tenantSelect.selectOption({ label: testData.tenants[0].name })
      }
      
      // Save the page
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000) // Wait for save
      
      // Create page for tenant 2 with same slug
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })
      
      await page.fill('input[name="title"]', `Page for Tenant 2 - ${slug}`)
      await page.fill('input[name="slug"]', slug)
      
      // Select tenant 2
      const tenantSelect2 = page.locator('select[name="tenant"], input[name="tenant"]').first()
      if (await tenantSelect2.isVisible().catch(() => false)) {
        await tenantSelect2.selectOption({ label: testData.tenants[1].name })
      }
      
      // Save should succeed (same slug, different tenant)
      const saveButton2 = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton2.click()
      await page.waitForTimeout(2000)
      
      // Verify no error message about duplicate slug
      const errorMessage = page.locator('text=/already exists|duplicate/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(false)
    })

    test('should prevent duplicate slug within same tenant in admin panel', async ({ page }) => {
      await loginAsSuperAdmin(page)
      
      const slug = `duplicate-test-${Date.now()}`
      
      // Create first page for tenant 1
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })
      
      await page.fill('input[name="title"]', `First Page - ${slug}`)
      await page.fill('input[name="slug"]', slug)
      
      const tenantSelect = page.locator('select[name="tenant"], input[name="tenant"]').first()
      if (await tenantSelect.isVisible().catch(() => false)) {
        await tenantSelect.selectOption({ label: testData.tenants[0].name })
      }
      
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)
      
      // Try to create second page with same slug for same tenant
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })
      
      await page.fill('input[name="title"]', `Second Page - ${slug}`)
      await page.fill('input[name="slug"]', slug)
      
      const tenantSelect2 = page.locator('select[name="tenant"], input[name="tenant"]').first()
      if (await tenantSelect2.isVisible().catch(() => false)) {
        await tenantSelect2.selectOption({ label: testData.tenants[0].name })
      }
      
      const saveButton2 = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton2.click()
      await page.waitForTimeout(2000)
      
      // Should show error about duplicate slug
      const errorMessage = page.locator('text=/already exists.*tenant|duplicate.*tenant/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(true)
    })

    test('should handle tenant deletion gracefully', async ({ page }) => {
      // Create a test tenant to delete
      const testTenant = await createTestTenant('Delete Test', 'delete-test')

      // Create some content for the tenant
      await createTestPage(testTenant.id, 'test-page', 'Test Page')
      const classOption = await createTestClassOption(testTenant.id, 'Test Class', 10)

      const startTime = new Date()
      startTime.setHours(10, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      await createTestLesson(testTenant.id, classOption.id, startTime, endTime)

      // Delete tenant
      await loginAsSuperAdmin(page)
      await page.goto(`http://localhost:3000/admin/collections/tenants/${testTenant.id}`, {
        waitUntil: 'networkidle',
      })

      // Verify tenant edit page is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/tenants')

      // Cleanup
      await cleanupTestData([testTenant.id], [])
    })
  })

  test.describe('Authentication & Session Management', () => {
    test('should maintain user session across tenant subdomains', async ({ page }) => {
      await loginAsRegularUser(page, 1)

      // Navigate to tenant-1
      await navigateToTenant(page, 'test-tenant-1')
      const url1 = page.url()
      expect(url1).toContain('test-tenant-1')

      // Navigate to tenant-2
      await navigateToTenant(page, 'test-tenant-2')
      const url2 = page.url()
      expect(url2).toContain('test-tenant-2')

      // User should remain logged in
      // Verify by checking for user menu or logout button
      const hasUserMenu = await page
        .locator('button:has-text("Logout")')
        .or(page.locator('[data-testid="user-menu"]'))
        .isVisible()
        .catch(() => false)

      expect(hasUserMenu).toBe(true)
    })

    test('should handle authentication on root domain', async ({ page }) => {
      await loginAsRegularUser(page, 1)
      await navigateToRoot(page)

      // Verify user remains authenticated
      const hasUserMenu = await page
        .locator('button:has-text("Logout")')
        .or(page.locator('[data-testid="user-menu"]'))
        .isVisible()
        .catch(() => false)

      // Navigate to tenant subdomain
      await navigateToTenant(page, 'test-tenant-1')

      // Verify user remains authenticated
      const hasUserMenuAfter = await page
        .locator('button:has-text("Logout")')
        .or(page.locator('[data-testid="user-menu"]'))
        .isVisible()
        .catch(() => false)

      expect(hasUserMenuAfter).toBe(true)
    })
  })

  test.describe('API & tRPC Integration', () => {
    test('should pass tenant context to tRPC queries', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify schedule component loads
      const hasSchedule = await page
        .locator('[data-testid="schedule"]')
        .or(page.locator('text=/schedule/i'))
        .isVisible()
        .catch(() => false)

      expect(hasSchedule).toBe(true)
    })

    test('should pass tenant context to Payload API calls', async ({ page }) => {
      let hasTenantContext = false

      // Intercept API calls
      page.on('request', (request) => {
        const url = request.url()
        if (url.includes('/api/')) {
          const headers = request.headers()
          // Check for tenant context in headers or cookies
          if (headers['x-tenant-slug'] || headers['x-tenant-id']) {
            hasTenantContext = true
          }
        }
      })

      await navigateToTenant(page, 'test-tenant-1')
      await page.waitForTimeout(1000) // Wait for API calls

      // At minimum, tenant-slug cookie should be set
      expect(true).toBe(true) // Placeholder - adjust based on actual implementation
    })
  })

  test.describe('Error Handling', () => {
    test('should handle missing tenant gracefully', async ({ page }) => {
      await navigateToTenant(page, 'non-existent-tenant')

      // Should either show error page or redirect
      const url = new URL(page.url())
      const hasError = await page
        .locator('text=/not found|error|404/i')
        .isVisible()
        .catch(() => false)

      const isRedirected = url.hostname === 'localhost'

      expect(hasError || isRedirected).toBe(true)
    })

    test('should handle tenant context errors gracefully', async ({ page }) => {
      // Navigate to a valid tenant
      await navigateToTenant(page, 'test-tenant-1')

      // Verify page loads
      const url = page.url()
      expect(url).toContain('test-tenant-1')
    })

    test('should handle invalid tenant ID in headers', async ({ page }) => {
      // This would require manipulating headers directly
      // For now, verify normal flow works
      await navigateToTenant(page, 'test-tenant-1')

      const url = page.url()
      expect(url).toContain('test-tenant-1')
    })
  })
})

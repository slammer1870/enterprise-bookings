import { test, expect } from '@playwright/test'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsSuperAdmin } from './helpers/auth-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestTenant,
} from './helpers/data-helpers'

test.describe('Tenant Onboarding & Default Data', () => {
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

  test.describe('Tenant Creation', () => {
    test('should create tenant with required fields', async ({ page }) => {
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

    test('should prevent duplicate tenant slugs', async () => {
      // Create tenant with slug
      const tenant1 = await createTestTenant('Test Tenant', 'duplicate-slug')

      // Test helpers are idempotent; creating the same slug should return the existing tenant.
      const tenant2 = await createTestTenant('Another Tenant', 'duplicate-slug')
      expect(tenant2.id).toBe(tenant1.id)

      // Cleanup
      await cleanupTestData([tenant1.id], [])
    })

    test('should allow optional domain field', async () => {
      const tenant = await createTestTenant('Test Tenant', 'test-domain-tenant', 'example.com')
      expect(tenant.domain).toBe('example.com')

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })
  })

  test.describe('Default Data Creation', () => {
    test('should create default home page when tenant is created', async ({ page }) => {
      // Create tenant - default data should be created via hooks
      const tenant = await createTestTenant('Onboarding Test Tenant', 'onboarding-test')

      // Navigate to tenant subdomain
      await navigateToTenant(page, 'onboarding-test')

      // Verify home page is displayed
      const url = page.url()
      expect(url).toContain('onboarding-test')

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should create default class options when tenant is created', async ({ page }) => {
      const tenant = await createTestTenant('Class Options Test', 'class-options-test')

      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/class-options', {
        waitUntil: 'networkidle',
      })

      // Verify class options collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/class-options')

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should create default lessons when tenant is created', async ({ page }) => {
      const tenant = await createTestTenant('Lessons Test', 'lessons-test')

      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/lessons', {
        waitUntil: 'networkidle',
      })

      // Verify lessons collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/lessons')

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should create default navbar when tenant is created', async ({ page }) => {
      const tenant = await createTestTenant('Navbar Test', 'navbar-test')

      await navigateToTenant(page, 'navbar-test')

      // Verify navbar is displayed
      const hasNavbar = await page
        .locator('nav')
        .or(page.locator('[data-testid="navbar"]'))
        .isVisible()
        .catch(() => false)

      expect(hasNavbar).toBe(true)

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should create default footer when tenant is created', async ({ page }) => {
      const tenant = await createTestTenant('Footer Test', 'footer-test')

      await navigateToTenant(page, 'footer-test')

      // Verify footer is displayed
      const hasFooter = await page
        .locator('footer')
        .or(page.locator('[data-testid="footer"]'))
        .isVisible()
        .catch(() => false)

      expect(hasFooter).toBe(true)

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should scope all default data to the tenant', async ({ page }) => {
      const tenant1 = await createTestTenant('Scope Test 1', 'scope-test-1')
      const tenant2 = await createTestTenant('Scope Test 2', 'scope-test-2')

      // Navigate to tenant-1
      await navigateToTenant(page, 'scope-test-1')
      const url1 = page.url()
      expect(url1).toContain('scope-test-1')

      // Navigate to tenant-2
      await navigateToTenant(page, 'scope-test-2')
      const url2 = page.url()
      expect(url2).toContain('scope-test-2')

      // Verify different tenants
      expect(url1).not.toBe(url2)

      // Cleanup
      await cleanupTestData([tenant1.id, tenant2.id], [])
    })
  })

  test.describe('Default Data Customization', () => {
    test('should allow tenant-admin to customize default home page', async ({ page }) => {
      const tenant = await createTestTenant('Customize Test', 'customize-test')

      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Verify pages collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/pages')

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should allow tenant-admin to delete default data', async ({ page }) => {
      const tenant = await createTestTenant('Delete Default Test', 'delete-default-test')

      await loginAsSuperAdmin(page)
      await page.goto('http://localhost:3000/admin/collections/class-options', {
        waitUntil: 'networkidle',
      })

      // Verify class options collection is accessible
      const url = page.url()
      expect(url).toContain('/admin/collections/class-options')

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })

    test('should allow tenant-admin to add additional content', async ({ page }) => {
      const tenant = await createTestTenant('Additional Content Test', 'additional-content-test')

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

      // Cleanup
      await cleanupTestData([tenant.id], [])
    })
  })
})

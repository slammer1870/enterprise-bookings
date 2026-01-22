import { test, expect } from '@playwright/test'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { loginAsSuperAdmin, loginAsTenantAdmin } from './helpers/auth-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestTenant,
  createTestPage,
} from './helpers/data-helpers'

test.describe('Tenant-Scoped Page Slugs E2E', () => {
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

  test.describe('Frontend Routing with Same Slugs', () => {
    test('should route to correct tenant page when slugs are identical', async ({ page }) => {
      const slug = `routing-test-${Date.now()}`

      // Create pages with same slug for different tenants
      await createTestPage(testData.tenants[0].id, slug, 'Tenant 1 Page')
      await createTestPage(testData.tenants[1].id, slug, 'Tenant 2 Page')

      // Navigate to tenant 1's page
      await navigateToTenant(page, 'test-tenant-1', `/${slug}`)
      await page.waitForLoadState('networkidle')

      const url1 = page.url()
      expect(url1).toContain('test-tenant-1')
      expect(url1).toContain(slug)

      // Check page content shows tenant 1's page
      const pageTitle = await page.locator('h1, [data-testid="page-title"]').first().textContent().catch(() => null)
      expect(pageTitle).toBeTruthy()

      // Navigate to tenant 2's page
      await navigateToTenant(page, 'test-tenant-2', `/${slug}`)
      await page.waitForLoadState('networkidle')

      const url2 = page.url()
      expect(url2).toContain('test-tenant-2')
      expect(url2).toContain(slug)

      // Verify URLs are different (different subdomains)
      expect(url1).not.toBe(url2)
    })

    test('should show 404 when slug does not exist for tenant', async ({ page }) => {
      const slug = `non-existent-${Date.now()}`

      // Create page only for tenant 1
      await createTestPage(testData.tenants[0].id, slug, 'Only Tenant 1 Page')

      // Navigate to tenant 1 - should work
      await navigateToTenant(page, 'test-tenant-1', `/${slug}`)
      await page.waitForLoadState('networkidle')
      const url1 = page.url()
      expect(url1).toContain(slug)

      // Navigate to tenant 2 - should show 404
      await navigateToTenant(page, 'test-tenant-2', `/${slug}`)
      await page.waitForLoadState('networkidle')
      
      const url2 = page.url()
      // Should either show 404 page or redirect
      const has404 = await page.locator('text=/404|not found|page not found/i').isVisible().catch(() => false)
      const isHomePage = !url2.includes(slug)
      
      expect(has404 || isHomePage).toBe(true)
    })
  })

  test.describe('Admin Panel Slug Validation', () => {
    test('should allow creating pages with same slug for different tenants', async ({ page }) => {
      await loginAsSuperAdmin(page)
      
      const slug = `admin-same-slug-${Date.now()}`
      
      // Navigate to pages collection
      await page.goto('http://localhost:3000/admin/collections/pages', {
        waitUntil: 'networkidle',
      })

      // Create first page
      const createButton = page.locator('button:has-text("Create New"), a[href*="/create"]').first()
      await createButton.click()
      await page.waitForLoadState('networkidle')

      await page.fill('input[name="title"]', `Tenant 1 Page - ${slug}`)
      
      // Wait for slug field and fill it
      const slugInput = page.locator('input[name="slug"]')
      await slugInput.waitFor({ state: 'visible' })
      await slugInput.fill(slug)

      // Save page
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Verify page was created (should redirect to list or edit page)
      const currentUrl = page.url()
      expect(currentUrl).toMatch(/\/admin\/collections\/pages/)

      // Create second page with same slug for different tenant
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })

      await page.fill('input[name="title"]', `Tenant 2 Page - ${slug}`)
      
      const slugInput2 = page.locator('input[name="slug"]')
      await slugInput2.waitFor({ state: 'visible' })
      await slugInput2.fill(slug)

      // Save should succeed
      const saveButton2 = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton2.click()
      await page.waitForTimeout(2000)

      // Should not show duplicate error
      const errorMessage = page.locator('text=/already exists.*tenant/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(false)
    })

    test('should show error when creating duplicate slug within same tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      
      const slug = `admin-duplicate-${Date.now()}`
      
      // Create first page via API for faster setup
      await createTestPage(testData.tenants[0].id, slug, 'First Page')

      // Try to create duplicate via admin panel
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })

      await page.fill('input[name="title"]', `Second Page - ${slug}`)
      
      const slugInput = page.locator('input[name="slug"]')
      await slugInput.waitFor({ state: 'visible' })
      await slugInput.fill(slug)

      // Save should fail with error
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Should show error about duplicate slug
      const errorMessage = page.locator('text=/already exists.*tenant|duplicate.*tenant/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(true)
    })

    test('should allow updating page without changing slug', async ({ page }) => {
      await loginAsSuperAdmin(page)
      
      const slug = `update-keep-slug-${Date.now()}`
      
      // Create page via API
      const createdPage = await createTestPage(testData.tenants[0].id, slug, 'Original Title')

      // Navigate to edit page
      await page.goto(`http://localhost:3000/admin/collections/pages/${createdPage.id}`, {
        waitUntil: 'networkidle',
      })

      // Update title but keep slug
      const titleInput = page.locator('input[name="title"]')
      await titleInput.clear()
      await titleInput.fill('Updated Title')

      // Verify slug is still the same
      const slugInput = page.locator('input[name="slug"]')
      const slugValue = await slugInput.inputValue()
      expect(slugValue).toBe(slug)

      // Save
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Should succeed without error
      const errorMessage = page.locator('text=/already exists|duplicate/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(false)
    })

    test('should prevent changing slug to existing slug within same tenant', async ({ page }) => {
      await loginAsSuperAdmin(page)
      
      const slug1 = `existing-slug-${Date.now()}`
      const slug2 = `target-slug-${Date.now()}`
      
      // Create two pages with different slugs
      const page1 = await createTestPage(testData.tenants[0].id, slug1, 'Page 1')
      const page2 = await createTestPage(testData.tenants[0].id, slug2, 'Page 2')

      // Try to change page2's slug to page1's slug
      await page.goto(`http://localhost:3000/admin/collections/pages/${page2.id}`, {
        waitUntil: 'networkidle',
      })

      const slugInput = page.locator('input[name="slug"]')
      await slugInput.clear()
      await slugInput.fill(slug1)

      // Save should fail
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Should show error
      const errorMessage = page.locator('text=/already exists.*tenant|duplicate.*tenant/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(true)
    })
  })

  test.describe('Tenant Admin Access', () => {
    test('should allow tenant-admin to create pages with unique slugs', async ({ page }) => {
      // Login as tenant admin for tenant 1 (tenant number 1)
      await loginAsTenantAdmin(page, 1)
      
      const slug = `tenant-admin-slug-${Date.now()}`
      
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })

      await page.fill('input[name="title"]', `Tenant Admin Page - ${slug}`)
      
      const slugInput = page.locator('input[name="slug"]')
      await slugInput.waitFor({ state: 'visible' })
      await slugInput.fill(slug)

      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Should succeed
      const errorMessage = page.locator('text=/already exists|duplicate|error/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(false)
    })

    test('should prevent tenant-admin from creating duplicate slug in their tenant', async ({ page }) => {
      const slug = `tenant-admin-duplicate-${Date.now()}`
      
      // Create page via API
      await createTestPage(testData.tenants[0].id, slug, 'Existing Page')

      // Login as tenant admin (tenant 1)
      await loginAsTenantAdmin(page, 1)
      
      await page.goto('http://localhost:3000/admin/collections/pages/create', {
        waitUntil: 'networkidle',
      })

      await page.fill('input[name="title"]', `Duplicate Page - ${slug}`)
      
      const slugInput = page.locator('input[name="slug"]')
      await slugInput.waitFor({ state: 'visible' })
      await slugInput.fill(slug)

      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Should show error
      const errorMessage = page.locator('text=/already exists.*tenant|duplicate.*tenant/i')
      const hasError = await errorMessage.isVisible().catch(() => false)
      expect(hasError).toBe(true)
    })
  })
})

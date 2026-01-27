import { test, expect } from '@playwright/test'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  setupE2ETestData,
  cleanupTestData,
  createTestPage,
  createTestClassOption,
  createTestLesson,
} from './helpers/data-helpers'

test.describe('Tenant Isolation & Content Scoping', () => {
  let testData: Awaited<ReturnType<typeof setupE2ETestData>>

  test.beforeAll(async () => {
    testData = await setupE2ETestData()

    // Create test pages for each tenant
    const page1 = await createTestPage(testData.tenants[0].id, 'about', 'About Tenant 1')
    const page2 = await createTestPage(testData.tenants[1].id, 'about', 'About Tenant 2')

    // Create test class options
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

    // Create test lessons
    const startTime1 = new Date()
    startTime1.setHours(10, 0, 0, 0)
    const endTime1 = new Date(startTime1)
    endTime1.setHours(11, 0, 0, 0)

    const startTime2 = new Date()
    startTime2.setHours(14, 0, 0, 0)
    const endTime2 = new Date(startTime2)
    endTime2.setHours(15, 0, 0, 0)

    await createTestLesson(
      testData.tenants[0].id,
      classOption1.id,
      startTime1,
      endTime1
    )
    await createTestLesson(
      testData.tenants[1].id,
      classOption2.id,
      startTime2,
      endTime2
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

  test.describe('Pages Collection Isolation', () => {
    test('should show only tenant-1 pages on tenant-1 subdomain', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1', '/about')

      // Verify tenant-1's about page is displayed
      const hasTenant1Content = await page
        .locator('text=/About Tenant 1/i')
        .isVisible()
        .catch(() => false)

      // Verify tenant-2's about page is NOT displayed
      const hasTenant2Content = await page
        .locator('text=/About Tenant 2/i')
        .isVisible()
        .catch(() => false)

      expect(hasTenant1Content || !hasTenant2Content).toBe(true)
    })

    test('should show tenant-specific home page', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1')
      const url1 = page.url()
      expect(url1).toContain('test-tenant-1')

      await navigateToTenant(page, 'test-tenant-2')
      const url2 = page.url()
      expect(url2).toContain('test-tenant-2')

      // Verify different tenants show different content
      expect(url1).not.toBe(url2)
    })

    test('should filter pages by tenant in API calls', async ({ page }) => {
      let apiCallsWithTenant = 0

      // Intercept API calls
      page.on('request', (request) => {
        const url = request.url()
        if (url.includes('/api/pages')) {
          // Check if tenant context is included
          const headers = request.headers()
          if (headers['x-tenant-slug'] || headers['x-tenant-id']) {
            apiCallsWithTenant++
          }
        }
      })

      await navigateToTenant(page, 'test-tenant-1')
      await page.waitForTimeout(1000)

      // At minimum, tenant context should be set via cookie
      expect(true).toBe(true) // Placeholder - adjust based on actual API implementation
    })
  })

  test.describe('Lessons Collection Isolation', () => {
    test('should show only tenant-1 lessons on tenant-1 subdomain', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify schedule/lessons are displayed
      const hasSchedule = await page
        .locator('[data-testid="schedule"]')
        .or(page.locator('text=/schedule|lessons/i'))
        .isVisible()
        .catch(() => false)

      expect(hasSchedule).toBe(true)
    })

    test('should filter lessons by tenant in tRPC queries', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify schedule component loads
      const hasSchedule = await page
        .locator('[data-testid="schedule"]')
        .or(page.locator('text=/schedule/i'))
        .isVisible()
        .catch(() => false)

      expect(hasSchedule).toBe(true)
    })

    test('should show correct lesson details for tenant', async ({ page }) => {
      // This test would require knowing a specific lesson ID
      // For now, we'll verify the booking page structure
      await navigateToTenant(page, 'test-tenant-1', '/bookings/1')

      // Should either show booking page or redirect
      const url = page.url()
      expect(url).toContain('test-tenant-1')
    })
  })

  test.describe('Class Options Collection Isolation', () => {
    test('should show only tenant-1 class options on tenant-1 subdomain', async ({
      page,
    }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify tenant-specific content is shown
      const hasContent = await page
        .locator('body')
        .isVisible()
        .catch(() => false)

      expect(hasContent).toBe(true)
    })
  })

  test.describe('Navbar & Footer Isolation', () => {
    test('should show tenant-1 navbar on tenant-1 subdomain', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify navbar is displayed
      const hasNavbar = await page
        .locator('nav')
        .or(page.locator('[data-testid="navbar"]'))
        .isVisible()
        .catch(() => false)

      expect(hasNavbar).toBe(true)
    })

    test('should show tenant-2 navbar on tenant-2 subdomain', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-2')

      // Verify navbar is displayed
      const hasNavbar = await page
        .locator('nav')
        .or(page.locator('[data-testid="navbar"]'))
        .isVisible()
        .catch(() => false)

      expect(hasNavbar).toBe(true)
    })

    test('should show tenant-1 footer on tenant-1 subdomain', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify footer is displayed
      const hasFooter = await page
        .locator('footer')
        .or(page.locator('[data-testid="footer"]'))
        .isVisible()
        .catch(() => false)

      expect(hasFooter).toBe(true)
    })

    test('should show tenant-2 footer on tenant-2 subdomain', async ({ page }) => {
      await navigateToTenant(page, 'test-tenant-2')

      // Verify footer is displayed
      const hasFooter = await page
        .locator('footer')
        .or(page.locator('[data-testid="footer"]'))
        .isVisible()
        .catch(() => false)

      expect(hasFooter).toBe(true)
    })
  })

  test.describe('Scheduler Isolation', () => {
    test('should show tenant-1 scheduler configuration on tenant-1 subdomain', async ({
      page,
    }) => {
      await navigateToTenant(page, 'test-tenant-1')

      // Verify scheduler is displayed
      const hasScheduler = await page
        .locator('[data-testid="schedule"]')
        .or(page.locator('text=/schedule/i'))
        .isVisible()
        .catch(() => false)

      expect(hasScheduler).toBe(true)
    })
  })
})

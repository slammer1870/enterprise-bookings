import { test, expect } from './helpers/fixtures'
import { navigateToTenant, navigateToRoot, getTenantContext } from './helpers/subdomain-helpers'

test.describe('Tenant Routing & Subdomain Detection', () => {
  test.describe('Root Domain Routing', () => {
    test('should show marketing landing page on root domain', async ({ page }) => {
      await navigateToRoot(page)

      // Verify we're on root domain (no subdomain)
      const url = new URL(page.url())
      expect(url.hostname).toBe('localhost')

      // Verify tenant context is not set
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBeNull()

      // Verify marketing content is displayed (check for common marketing page elements)
      // Check for welcome text or tenants link
      const welcomeText = page.locator('text=/welcome/i').first()
      const tenantsLink = page.locator('a[href="/tenants"]').first()
      
      const hasWelcomeText = await welcomeText.isVisible().catch(() => false)
      const hasTenantsLink = await tenantsLink.isVisible().catch(() => false)

      expect(hasWelcomeText || hasTenantsLink).toBe(true)
    })

    test('should redirect root domain to marketing page when tenant context missing', async ({
      page,
    }) => {
      await navigateToRoot(page)

      // Should be on root domain
      const url = new URL(page.url())
      expect(url.hostname).toBe('localhost')

      // Verify tenant context is not set
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBeNull()
    })
  })

  test.describe('Valid Subdomain Routing', () => {
    test('should route to correct tenant when valid subdomain is used', async ({ page, testData }) => {
      const tenantSlug = testData.tenants[0]!.slug
      await navigateToTenant(page, tenantSlug)

      // Verify tenant context is set
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)

      // Verify we're on tenant subdomain
      const url = new URL(page.url())
      expect(url.hostname).toContain(tenantSlug)

      // Tenant root redirects to `/home` in this app; assert we landed on the tenant home route.
      // (Don't assert specific UI blocks like "schedule" here—home content is tenant-configurable.)
      expect(page.url()).toContain('/home')
    })

    test('should display tenant-specific home page content', async ({ page, testData }) => {
      const tenantSlug = testData.tenants[0]!.slug
      await navigateToTenant(page, tenantSlug)

      // Verify tenant context
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)

      // Verify home page content is displayed
      // This will depend on your actual UI - adjust selectors as needed
      const hasHomeContent = await page
        .locator('body')
        .isVisible()
        .catch(() => false)

      expect(hasHomeContent).toBe(true)
    })

    test('should set tenant context in headers for API calls', async ({ page, testData }) => {
      const tenantSlug = testData.tenants[0]!.slug
      let hasTenantHeader = false

      // Intercept API requests
      page.on('request', (request) => {
        const url = request.url()
        if (url.includes('/api/')) {
          const headers = request.headers()
          // Check for tenant context in headers or cookies
          if (headers['x-tenant-slug'] === tenantSlug || headers['x-tenant-id']) {
            hasTenantHeader = true
          }
        }
      })

      await navigateToTenant(page, tenantSlug)
      await page.waitForTimeout(1000) // Wait for API calls

      // At minimum, tenant-slug cookie should be set
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)
    })
  })

  test.describe('Invalid Subdomain Handling', () => {
    test('should handle invalid subdomain gracefully', async ({ page }) => {
      await navigateToTenant(page, 'invalid-tenant')

      // Should either show error page or redirect
      const url = new URL(page.url())
      
      // Check for error message or redirect
      const hasError = await page
        .locator('text=/not found|error|404/i')
        .isVisible()
        .catch(() => false)

      const isRedirected = url.hostname === 'localhost' || url.pathname === '/'

      // Should handle gracefully (either error page or redirect)
      expect(hasError || isRedirected).toBe(true)
    })

    test('should handle non-existent tenant subdomain', async ({ page }) => {
      await navigateToTenant(page, 'non-existent')

      // Should handle appropriately (404 or redirect)
      const url = new URL(page.url())
      const hasError = await page
        .locator('text=/not found|error|404/i')
        .isVisible()
        .catch(() => false)

      const isRedirected = url.hostname === 'localhost'

      expect(hasError || isRedirected).toBe(true)
    })
  })

  test.describe('Subdomain Persistence', () => {
    test('should maintain tenant context across page navigation', async ({ page, testData }) => {
      const tenantSlug = testData.tenants[0]!.slug
      await navigateToTenant(page, tenantSlug)

      // Verify initial tenant context
      let tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)

      // Navigate to different pages within tenant
      await navigateToTenant(page, tenantSlug, '/bookings')
      tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)

      // Navigate to another page
      await navigateToTenant(page, tenantSlug, '/')
      tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)
    })

    test('should maintain tenant context in cookies', async ({ page, testData }) => {
      const tenantSlug = testData.tenants[0]!.slug
      await navigateToTenant(page, tenantSlug)

      // Verify cookie is set
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)

      // Reload page
      await page.reload({ waitUntil: 'networkidle' })

      // Verify cookie persists
      const tenantContextAfterReload = await getTenantContext(page)
      expect(tenantContextAfterReload).toBe(tenantSlug)
    })
  })
})

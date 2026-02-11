import { test, expect } from './helpers/fixtures'
import { navigateToTenant, navigateToRoot, getTenantContext } from './helpers/subdomain-helpers'

test.describe('Tenant Routing & Subdomain Detection', () => {
  test.describe('Root Domain Routing', () => {
    test('should show marketing page on root domain without tenant context', async ({ page }) => {
      await navigateToRoot(page)
      const url = new URL(page.url())
      expect(url.hostname).toBe('localhost')
      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBeNull()
    })
  })

  test.describe('Valid Subdomain Routing', () => {
    test('should route to tenant subdomain and render home at /', async ({ page, testData }) => {
      const tenantSlug = testData.tenants[0]!.slug
      await navigateToTenant(page, tenantSlug)

      // Home page content is rendered at / (no redirect to /home)
      const tenantRootUrl = `http://${tenantSlug}.localhost:3000/`
      try {
        await page.waitForURL(tenantRootUrl, { timeout: 10000 })
      } catch {
        const currentUrl = page.url()
        const has404 = page.locator('text=/tenant not found|404/i').first()
        const is404 = await has404.isVisible().catch(() => false)
        if (is404) throw new Error(`Tenant "${tenantSlug}" not found at ${currentUrl}`)
        throw new Error(`Expected to render at tenant root but got: ${currentUrl}`)
      }

      const tenantContext = await getTenantContext(page)
      expect(tenantContext).toBe(tenantSlug)
      const url = new URL(page.url())
      expect(url.hostname).toContain(tenantSlug)
      expect(url.pathname).toBe('/')
    })
  })

  test.describe('Invalid Subdomain Handling', () => {
    test('should handle invalid subdomain gracefully', async ({ page }) => {
      await navigateToTenant(page, 'invalid-tenant')
      const url = new URL(page.url())
      const hasError = await page
        .locator('text=/tenant not found|page not found|not found|404/i')
        .first()
        .isVisible()
        .catch(() => false)
      const isRedirected = url.hostname === 'localhost' || url.pathname === '/'
      expect(hasError || isRedirected).toBe(true)
    })
  })
})

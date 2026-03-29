import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestPage } from './helpers/data-helpers'

test.describe('Tenant-Scoped Page Slugs', () => {
  test('should route to correct tenant page when multiple tenants use same slug', async ({
    page,
    testData,
  }) => {
    const slug = `routing-test-${Date.now()}`
    const t1 = testData.tenants[0]!
    const t2 = testData.tenants[1]!

    await createTestPage(t1.id, slug, 'Tenant 1 Page')
    await createTestPage(t2.id, slug, 'Tenant 2 Page')

    await navigateToTenant(page, t1.slug, `/${slug}`)
    await page.waitForLoadState('networkidle')
    const url1 = page.url()
    expect(url1).toContain(t1.slug)
    expect(url1).toContain(slug)

    await navigateToTenant(page, t2.slug, `/${slug}`)
    await page.waitForLoadState('networkidle')
    const url2 = page.url()
    expect(url2).toContain(t2.slug)
    expect(url2).toContain(slug)
    expect(url1).not.toBe(url2)
  })
})

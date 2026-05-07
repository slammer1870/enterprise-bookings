import { test, expect } from './helpers/fixtures'
import { navigateToRoot, navigateToTenant } from './helpers/subdomain-helpers'
import { getPayloadInstance, createTestPage } from './helpers/data-helpers'

test.describe('Root vs tenant page routing', () => {
  test('renders root page on base host and tenant page on tenant subdomain', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenant1 = testData.tenants[0]!

    const slug = `root-tenant-router-${Date.now()}`
    const rootTitle = 'Root semantics e2e page'
    const tenantTitle = 'Tenant semantics e2e page'

    // Root/global page: tenant === null
    await payload.create({
      collection: 'pages',
      data: {
        slug,
        title: rootTitle,
        tenant: null,
        _status: 'published',
        layout: [{ blockType: 'heroSchedule', title: rootTitle }],
      },
      overrideAccess: true,
      draft: false,
    })

    // Tenant page with same slug
    await createTestPage(tenant1.id, slug, tenantTitle, {
      layout: [{ blockType: 'heroSchedule', title: tenantTitle }],
    })

    // Root domain should show the root/global page.
    await navigateToRoot(page, `/${slug}`)
    await expect(page.getByText(rootTitle)).toBeVisible()
    await expect(page.getByText(tenantTitle)).toHaveCount(0)

    // Tenant subdomain should show the tenant-scoped page.
    await navigateToTenant(page, tenant1.slug, `/${slug}`)
    await expect(page.getByText(tenantTitle)).toBeVisible()
    await expect(page.getByText(rootTitle)).toHaveCount(0)
  })
})


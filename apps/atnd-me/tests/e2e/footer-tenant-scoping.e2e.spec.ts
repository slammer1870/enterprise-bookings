import { expect, test } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { getPayloadInstance } from './helpers/data-helpers'

test('footer is correctly scoped per tenant', async ({ page, testData }) => {
  const payload = await getPayloadInstance()
  const tenant1 = testData.tenants[0]
  const tenant2 = testData.tenants[1]

  const tenant1Text = `E2E TENANT 1 FOOTER ${testData.workerIndex}`
  const tenant2Text = `E2E TENANT 2 FOOTER ${testData.workerIndex}`

  // Ensure only tenant 1 has a footer initially
  await payload.delete({
    collection: 'footer',
    where: { tenant: { in: [tenant1.id, tenant2.id] } },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'footer',
    data: {
      tenant: tenant1.id,
      logoLink: '/',
      copyrightText: tenant1Text,
      navItems: [],
    },
    overrideAccess: true,
  })

  // Tenant 2 should NOT resolve tenant 1 footer
  await navigateToTenant(page, tenant2.slug, '/')
  await expect(page.getByText(tenant1Text)).toHaveCount(0)

  // Create footer for tenant 2 and confirm it renders there
  await payload.create({
    collection: 'footer',
    data: {
      tenant: tenant2.id,
      logoLink: '/',
      copyrightText: tenant2Text,
      navItems: [],
    },
    overrideAccess: true,
  })

  await navigateToTenant(page, tenant2.slug, '/')
  await expect(page.getByText(tenant2Text)).toBeVisible()
  await expect(page.getByText(tenant1Text)).toHaveCount(0)

  // Navigate back to tenant 1 and confirm it still has tenant 1 footer
  await navigateToTenant(page, tenant1.slug, '/')
  await expect(page.getByText(tenant1Text)).toBeVisible()
  await expect(page.getByText(tenant2Text)).toHaveCount(0)
})


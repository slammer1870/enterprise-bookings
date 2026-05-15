/**
 * Phase 7 Chunk 8 — `/locations/{slug}` sets `branch-slug` and renders a minimal branch hub.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant, getBranchSlugFromCookies } from './helpers/subdomain-helpers'
import { getPayloadInstance } from './helpers/data-helpers'

test.describe('Public location branch route', () => {
  test('sets branch-slug cookie and shows branch title', async ({ page, testData }) => {
    const tenant = testData.tenants[0]!
    const slug = `e2e-branch-${testData.workerIndex}-${Date.now()}`
    const payload = await getPayloadInstance()
    await payload.create({
      collection: 'locations',
      data: {
        tenant: tenant.id,
        name: 'E2E Public Branch',
        slug,
      },
      overrideAccess: true,
    })

    await navigateToTenant(page, tenant.slug, `/locations/${slug}`)

    await expect(page.getByRole('heading', { name: 'E2E Public Branch' })).toBeVisible()
    expect(await getBranchSlugFromCookies(page)).toBe(slug)
  })
})

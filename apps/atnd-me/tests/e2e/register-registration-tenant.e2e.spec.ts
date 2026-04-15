/**
 * E2E: passwordless registration from a tenant subdomain sets users.registrationTenant.
 *
 * Custom-domain browser flow: register-registration-tenant-custom-domain.e2e.spec.ts (nip.io).
 * Proxy header ordering (X-Forwarded-Host vs Host) is covered in
 * tests/int/registration-tenant-custom-domain.int.spec.ts.
 */
import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { getPayloadInstance } from './helpers/data-helpers'

test.describe('Registration tenant (E2E)', () => {
  test.describe.configure({ timeout: 120_000 })

  test('register from tenant subdomain persists registrationTenant', async ({ page, testData }) => {
    const tenant = testData.tenants[0]
    if (!tenant?.id || !tenant.slug) throw new Error('fixture tenant missing')

    const email = `e2eregw${testData.workerIndex}${Date.now()}@test.com`
    const name = 'E2E Registrant'

    await navigateToTenant(page, tenant.slug, '/complete-booking?mode=register')

    // CardTitle is a div in @repo/ui/card, not a semantic heading
    await expect(page.getByText(/create an account/i)).toBeVisible({ timeout: 15_000 })

    await page.getByPlaceholder(/your name/i).fill(name)
    await page.getByPlaceholder(/your email/i).fill(email)

    await page.getByRole('button', { name: /^submit$/i }).click()
    await page.waitForURL(/\/magic-link-sent/, { timeout: 30_000 })

    await expect(page.getByRole('heading', { name: /^magic link sent$/i })).toBeVisible({
      timeout: 30_000,
    })

    const payload = await getPayloadInstance()
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    expect(found.docs.length).toBe(1)
    const user = found.docs[0] as { registrationTenant?: number | { id: number } | null }
    const regId =
      typeof user.registrationTenant === 'object' && user.registrationTenant !== null
        ? user.registrationTenant.id
        : user.registrationTenant
    expect(regId).toBe(tenant.id)
  })
})

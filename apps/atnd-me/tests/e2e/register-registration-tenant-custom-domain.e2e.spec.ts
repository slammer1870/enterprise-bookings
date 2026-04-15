/**
 * E2E: passwordless registration from a tenant custom domain sets users.registrationTenant.
 *
 * Uses *.127.0.0.1.nip.io so DNS resolves to loopback while Host is not *.localhost,
 * exercising middleware tenant-by-host resolution like production custom domains.
 * Requires outbound DNS (nip.io) — same as staff-admin-custom-domain.e2e.spec.ts.
 *
 * Better Auth `/auth/sign-up` on custom domain: auth-sign-up-registration-tenant-custom-domain.e2e.spec.ts.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- register-registration-tenant-custom-domain
 */
import { test, expect } from './helpers/fixtures'
import { createTestTenant, getPayloadInstance } from './helpers/data-helpers'

test.describe('Registration tenant (custom domain E2E)', () => {
  test.describe.configure({ timeout: 120_000 })

  let registerOrigin: string
  let tenantId: number

  test.beforeAll(async ({ testData }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    const host = `e2e-reg-${w}-${stamp}.127.0.0.1.nip.io`
    registerOrigin = `http://${host}:3000`

    const slug = `reg-cd-${w}-${stamp}`
    const tenant = await createTestTenant(`E2E reg custom domain ${w}`, slug, host)
    if (tenant.id == null) throw new Error('tenant missing id')
    tenantId = tenant.id
  })

  test('register from tenant custom domain persists registrationTenant', async ({ page }) => {
    const email = `e2eregcd${Date.now()}@test.com`
    const name = 'E2E Registrant Custom Domain'

    await page.goto(`${registerOrigin}/complete-booking?mode=register`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null)

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
    expect(regId).toBe(tenantId)
  })
})

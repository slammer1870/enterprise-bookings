/**
 * E2E: Better Auth email/password sign-up from `/auth/sign-up` on a tenant custom domain
 * sets `users.registrationTenant` (exercises Host-based tenant resolution + beforeChange hook).
 *
 * Uses *.127.0.0.1.nip.io like register-registration-tenant-custom-domain.e2e.spec.ts.
 * Requires outbound DNS (nip.io).
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- auth-sign-up-registration-tenant-custom-domain
 */
import { test, expect } from './helpers/fixtures'
import { createTestTenant, getPayloadInstance } from './helpers/data-helpers'

test.describe('Better Auth /auth/sign-up registrationTenant (custom domain E2E)', () => {
  test.describe.configure({ timeout: 120_000 })

  let registerOrigin: string
  let tenantId: number

  test.beforeAll(async ({ testData }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    const host = `e2e-bauth-${w}-${stamp}.127.0.0.1.nip.io`
    registerOrigin = `http://${host}:3000`

    const slug = `bauth-cd-${w}-${stamp}`
    const tenant = await createTestTenant(`E2E Better Auth CD ${w}`, slug, host)
    if (tenant.id == null) throw new Error('tenant missing id')
    tenantId = tenant.id
  })

  test('sign-up from /auth/sign-up on custom domain persists registrationTenant', async ({
    page,
  }) => {
    const email = `e2ebauthsu${Date.now()}@test.com`
    const name = 'E2E Better Auth Sign-Up'
    const password = 'e2e-signup-pass-9aa!'

    await page.goto(`${registerOrigin}/auth/sign-up`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => null)

    await expect(page.locator('[data-slot="card-title"]')).toHaveText(/sign up/i, {
      timeout: 15_000,
    })

    const nameBox = page.getByRole('textbox', { name: /^name$/i })
    if ((await nameBox.count()) > 0 && (await nameBox.first().isVisible())) {
      await nameBox.first().fill(name)
    }

    await page.getByRole('textbox', { name: /^email$/i }).fill(email)
    // Match the a11y tree (`textbox "Password"`). Label-based locators can miss PasswordInput wrappers.
    const passwordInput = page.getByRole('textbox', { name: /^password$/i })
    await expect(passwordInput).toBeVisible()
    await passwordInput.fill(password)
    await expect(passwordInput).toHaveValue(password)

    // Do not require `r.ok()` in the predicate — a 4xx would never match and would mask the real failure.
    const signUpResponsePromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/api\/auth\//.test(r.url()) &&
        /sign-up|signup/i.test(r.url()),
      { timeout: 45_000 },
    )

    // better-auth-ui uses localized SIGN_UP_ACTION ("Create an account"), not the card title "Sign up".
    const submitSignUp = page.getByRole('button', {
      name: /^(create an account|sign up)$/i,
    })
    await submitSignUp.click()
    const signUpResponse = await signUpResponsePromise
    if (!signUpResponse.ok()) {
      const body = await signUpResponse.text().catch(() => '')
      throw new Error(`sign-up failed: ${signUpResponse.status()} ${body}`)
    }

    // Successful credential sign-up redirects to sign-in (email verification off in app config).
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 30_000 }).catch(() => null)

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

/**
 * Step 2.6.1 – E2E: Payment method controls gated by Stripe Connect.
 * - When tenant not connected: payment controls disabled/hidden, callout "Connect Stripe to enable payments", Connect CTA visible.
 * - When tenant connected: payment controls enabled, status shows "Stripe connected".
 */
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin, BASE_URL } from './helpers/auth-helpers'
import { createTestClassOption } from './helpers/data-helpers'

test.describe('Admin payment methods gated by Stripe Connect', () => {
  test('when not connected, shows "Connect Stripe to enable payments" and Connect CTA on class option edit', async ({
    page,
    testData,
    request,
  }) => {
    const co = await createTestClassOption(testData.tenants[0]!.id, 'Gated Test Class', 5)
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/class-options/${co.id}`, {
      waitUntil: 'networkidle',
    })

    // Allow Stripe status request to settle (do not couple to response code)
    await page
      .waitForResponse((resp) => resp.url().includes('/api/stripe/connect/status'), { timeout: 15000 })
      .catch(() => null)

    // Ensure we're in the class-option edit view (CI can be slower; don't couple to doc title markup)
    await page
      .waitForURL((url) => url.pathname.includes(`/admin/collections/class-options/${co.id}`), {
        timeout: 30000,
      })
      .catch(() => null)

    // Scroll so below-fold Payment Methods section can render (Payload admin can virtualize fields).
    // Do this via page-level evaluate so we don't hang if <main> is temporarily missing during navigation/hydration.
    await page
      .evaluate(() => {
        const main = document.querySelector('main') as HTMLElement | null
        const el = main ?? (document.scrollingElement as HTMLElement | null) ?? document.body
        try {
          el?.scrollTo?.(0, el.scrollHeight)
        } catch {
          // ignore
        }
        try {
          window.scrollTo(0, document.body.scrollHeight)
        } catch {
          // ignore
        }
      })
      .catch(() => null)

    // Wait for the gated field to render (either not-connected or connected state)
    await expect(page.getByTestId('require-stripe-connect')).toBeVisible({ timeout: 15000 })

    // Target the <strong> element specifically to avoid strict mode violation
    await expect(
      page.locator('strong:has-text("Connect Stripe to enable payments")')
    ).toBeVisible({ timeout: 10000 })

    // Verify the descriptive text is present
    await expect(
      page.getByText(/to accept payments and enable payment methods/i)
    ).toBeVisible()

    // Verify the Connect CTA link is visible
    const gatedSection = page.getByTestId('require-stripe-connect')
    await expect(gatedSection.getByRole('link', { name: /connect stripe/i })).toBeVisible()
  })

  test('when connected, payment controls are visible and status shows "Stripe connected" on class option edit', async ({
    page,
    testData,
    request,
  }) => {
    const { getPayload } = await import('payload')
    const configMod = await import('../../src/payload.config')
    const payloadConfig = await configMod.default
    const payload = await getPayload({
      config: payloadConfig,
    })
    const tenantId = testData.tenants[0]!.id
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_e2e_gated_${tenantId}`,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenantId, 'Connected Test Class', 5)
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/class-options/${co.id}`, {
      waitUntil: 'networkidle',
    })

    // Allow Stripe status request to settle (do not couple to response code)
    await page
      .waitForResponse((resp) => resp.url().includes('/api/stripe/connect/status'), { timeout: 15000 })
      .catch(() => null)

    await page
      .waitForURL((url) => url.pathname.includes(`/admin/collections/class-options/${co.id}`), {
        timeout: 30000,
      })
      .catch(() => null)
    await page
      .evaluate(() => {
        const main = document.querySelector('main') as HTMLElement | null
        const el = main ?? (document.scrollingElement as HTMLElement | null) ?? document.body
        try {
          el?.scrollTo?.(0, el.scrollHeight)
        } catch {
          // ignore
        }
        try {
          window.scrollTo(0, document.body.scrollHeight)
        } catch {
          // ignore
        }
      })
      .catch(() => null)

    await expect(page.getByTestId('require-stripe-connect')).toBeVisible({ timeout: 15000 })

    const gatedSection = page.getByTestId('require-stripe-connect')
    await expect(gatedSection.getByText(/stripe connected/i)).toBeVisible({ timeout: 10000 })

    // Payment method section should be present (e.g. "Payment Methods" or "Enable payments")
    const paymentSection = page.getByText(/payment methods|enable payments/i).first()
    await expect(paymentSection).toBeVisible()
  })
})

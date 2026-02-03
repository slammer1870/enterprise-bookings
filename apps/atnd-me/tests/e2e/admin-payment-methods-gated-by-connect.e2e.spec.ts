/**
 * Step 2.6.1 – E2E: Payment method controls gated by Stripe Connect.
 * - When tenant not connected: payment controls disabled/hidden, callout "Connect Stripe to enable payments", Connect CTA visible.
 * - When tenant connected: payment controls enabled, status shows "Stripe connected".
 */
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin } from './helpers/auth-helpers'
import { createTestClassOption } from './helpers/data-helpers'

test.describe('Admin payment methods gated by Stripe Connect', () => {
  test('when not connected, shows "Connect Stripe to enable payments" and Connect CTA on class option edit', async ({
    page,
    testData,
    request,
  }) => {
    const co = await createTestClassOption(testData.tenants[0]!.id, 'Gated Test Class', 5)
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`http://localhost:3000/admin/collections/class-options/${co.id}`, {
      waitUntil: 'networkidle',
    })

    // Target the <strong> element specifically to avoid strict mode violation
    await expect(
      page.locator('strong:has-text("Connect Stripe to enable payments")')
    ).toBeVisible()

    // Verify the descriptive text is present
    await expect(
      page.getByText(/to accept payments and enable payment methods/i)
    ).toBeVisible()

    // Verify the Connect CTA link is visible
    await expect(
      page.getByRole('link', { name: /connect stripe/i })
    ).toBeVisible()
  })

  test('when connected, payment controls are visible and status shows "Stripe connected" on class option edit', async ({
    page,
    testData,
    request,
  }) => {
    const { getPayload } = await import('payload')
    const configMod = await import('@/payload.config')
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
    await page.goto(`http://localhost:3000/admin/collections/class-options/${co.id}`, {
      waitUntil: 'networkidle',
    })

    await expect(
      page.getByText(/stripe connected/i).or(page.locator('text=/stripe connected/i'))
    ).toBeVisible()

    // Payment method section should be present (e.g. "Payment Methods" or "Enable payments")
    const paymentSection = page.getByText(/payment methods|enable payments/i).first()
    await expect(paymentSection).toBeVisible()
  })
})

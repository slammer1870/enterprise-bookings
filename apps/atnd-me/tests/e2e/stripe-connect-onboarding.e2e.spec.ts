/**
 * Step 2.6 – E2E: Tenant-admin "Connect Stripe" + connection status.
 * - Tenant-admin sees "Connect Stripe" when not connected.
 * - Clicking initiates OAuth (redirect to Stripe).
 * - When connected, UI shows "Stripe connected" and hides connect CTA.
 * Uses class-option edit page (RequireStripeConnectField) so we don't depend on admin header slot.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsTenantAdmin, BASE_URL } from './helpers/auth-helpers'
import { createTestClassOption } from './helpers/data-helpers'

test.describe('Stripe Connect onboarding (tenant-admin)', () => {
  test('tenant-admin sees "Connect Stripe" when not connected', async ({ page, testData, request }) => {
    const { getPayload } = await import('payload')
    const configMod = await import('@/payload.config')
    const payload = await getPayload({ config: await configMod.default })
    const tenant = testData.tenants[0]!
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'not_connected',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenant.id, 'Onboarding Test Class', 5)
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/class-options/${co.id}`, { waitUntil: 'networkidle' })

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/stripe/connect/status') && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => null)

    await expect(page.getByTestId('require-stripe-connect')).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByRole('link', { name: /connect stripe/i }).or(page.locator('a:has-text("Connect Stripe")'))
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking "Connect Stripe" redirects to Stripe OAuth', async ({ page, testData, request }) => {
    const { getPayload } = await import('payload')
    const configMod = await import('@/payload.config')
    const payload = await getPayload({ config: await configMod.default })
    const tenant = testData.tenants[0]!
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'not_connected',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenant.id, 'OAuth Redirect Test Class', 5)
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/class-options/${co.id}`, { waitUntil: 'networkidle' })

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/stripe/connect/status') && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => null)

    await expect(page.getByTestId('require-stripe-connect')).toBeVisible({ timeout: 15000 })
    const connectLink = page
      .getByRole('link', { name: /connect stripe/i })
      .or(page.locator('a:has-text("Connect Stripe")'))
      .first()
    await expect(connectLink).toBeVisible({ timeout: 10000 })

    const href = await connectLink.getAttribute('href')
    expect(href).toBeDefined()
    expect(href).toMatch(/\/api\/stripe\/connect\/authorize/)
    expect(href).toMatch(/tenantSlug=|tenant-slug/)

    // Use request context (sends cookies) and do not follow redirects so we assert our 302
    const fullUrl = href!.startsWith('http') ? href! : `${BASE_URL}${href}`
    const response = await page.request.get(fullUrl, { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    const location = response.headers()['location'] ?? ''
    expect(location).toMatch(/connect\.stripe\.com|stripe\.com/)
  })

  test('when connected, UI shows "Stripe connected" and hides Connect CTA', async ({
    page,
    testData,
    request,
  }) => {
    const { getPayload } = await import('payload')
    const configMod = await import('@/payload.config')
    const payloadConfig = await configMod.default
    const payload = await getPayload({ config: payloadConfig })
    const tenant1 = testData.tenants[0]!
    await payload.update({
      collection: 'tenants',
      id: tenant1.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_e2e_connected_${tenant1.id}`,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenant1.id, 'Connected Status Test Class', 5)
    await loginAsTenantAdmin(page, 1, testData.users.tenantAdmin1.email, { request })
    await page.goto(`${BASE_URL}/admin/collections/class-options/${co.id}`, { waitUntil: 'networkidle' })

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/stripe/connect/status') && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => null)

    await expect(page.getByTestId('require-stripe-connect')).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText(/stripe connected/i).or(page.locator('text=/stripe connected/i'))
    ).toBeVisible({ timeout: 10000 })

    const connectCta = page
      .getByRole('link', { name: /connect stripe/i })
      .or(page.locator('a:has-text("Connect Stripe")'))
    await expect(connectCta).not.toBeVisible()
  })
})

/**
 * Phase 4.6 – E2E: Booking page for a lesson that allows class passes; user with valid pass
 * sees Class pass tab; confirm with class pass redirects to success; booking confirmed and pass decremented.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestClassOption,
  createTestLesson,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Booking with class pass (Phase 4.6)', () => {
  test.describe.configure({ timeout: 90_000, mode: 'serial' })

  test('lesson with class pass only: user with valid pass sees Class pass tab and can confirm', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    // Class pass payment-method gating only requires the tenant to be marked active.
    // Avoid attaching a fake Connect account so tests do not attempt real Stripe calls.
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: null,
      },
      overrideAccess: true,
    })

    const co = await createTestClassOption(tenantId, 'Class Pass Only', 5, undefined, w)
    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `E2E 5-Pack w${w} ${Date.now()}`,
        slug: `e2e-5pack-${tenantId}-${Date.now()}`,
        quantity: 5,
        tenant: tenantId,
        priceInformation: { price: 29.99 },
        skipSync: true,
        stripeProductId: `prod_test_${tenantId}_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const future = new Date(Date.now() + 86400000 * 30)
    const pass = await payload.create({
      collection: 'class-passes',
      data: {
        user: testData.users.user1.id,
        tenant: tenantId,
        type: cpt.id,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 2999,
        status: 'active',
      },
      overrideAccess: true,
    }) as { id: number }

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 600))

    // API login + tenant-scoped cookies so session is sent on tenant subdomain (avoids "Booking page error" from unauthenticated server render).
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', { tenantSlug })
    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first()
    ).toBeVisible({ timeout: 15000 })
    const qty = page.getByRole('button', { name: /increase quantity/i }).first()
    await qty.click().catch(() => null)

    // Wait for payment methods to resolve (getValidClassPassesForLesson) so Class pass tab can appear
    await page.waitForTimeout(2000)
    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15000 })

    await classPassTab.click()
    await expect(page.getByText(/use this pass|confirm with class pass|remaining/i).first()).toBeVisible({ timeout: 5000 })

    const confirmBtn = page.getByRole('button', { name: /confirm with class pass|book|use pass/i }).first()
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/your booking has been confirmed/i)).toBeVisible()

    await expect
      .poll(async () => {
        const passAfter = await payload.findByID({
          collection: 'class-passes',
          id: pass.id,
          depth: 0,
          overrideAccess: true,
        }) as { quantity: number }

        return passAfter.quantity
      }, { timeout: 10000 })
      .toBe(3)
  })
})

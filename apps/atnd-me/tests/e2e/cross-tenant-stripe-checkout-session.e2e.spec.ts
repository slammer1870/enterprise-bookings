/**
 * Cross-tenant Stripe Checkout (Connect): user is registered on tenant A and already has a
 * Stripe customer mapping for tenant A's connected account. They start a class-pass purchase
 * on tenant B (different Connect account). The checkout-session route must resolve a
 * customer id scoped to tenant B without reusing tenant A's customer.
 *
 * In e2e, ENABLE_TEST_WEBHOOKS + NODE_ENV=test mock hosted Checkout; we assert the API
 * succeeds and `users.stripeCustomers` gains a second mapping for tenant B's account.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { createTestEventType, createTestTimeslot, getPayloadInstance } from './helpers/data-helpers'

test.describe('Cross-tenant Stripe Checkout session (Connect)', () => {
  test.describe.configure({ timeout: 90_000, mode: 'serial' })

  test('user with tenant-A Stripe mapping can start class-pass checkout on tenant B', async ({
    page,
    testData,
  }) => {
    const payload = await getPayloadInstance()
    const tenantA = testData.tenants[0]!
    const tenantB = testData.tenants[1]!
    const user = testData.users.user1
    const w = testData.workerIndex

    if (!tenantA?.id || !tenantB?.id || !tenantA.slug || !tenantB.slug || !user?.id) {
      throw new Error('Missing tenant/user setup')
    }

    const accountA = `acct_smoke_${tenantA.id}`
    const accountB = `acct_smoke_${tenantB.id}`
    if (accountA === accountB) {
      throw new Error('Test requires two tenants with distinct ids (distinct Connect accounts)')
    }

    await payload.update({
      collection: 'tenants',
      id: tenantA.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: accountA,
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'tenants',
      id: tenantB.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: accountB,
      },
      overrideAccess: true,
    })

    const priorCustomerA = 'cus_cross_tenant_checkout_tenant_a'
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        stripeCustomers: [{ stripeAccountId: accountA, stripeCustomerId: priorCustomerA }],
      },
      overrideAccess: true,
    })

    const co = await createTestEventType(tenantB.id, 'Cross-tenant checkout class pass', 5, undefined, w)
    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Cross-tenant checkout CP w${w} ${Date.now()}`,
        slug: `e2e-cross-tenant-checkout-${tenantB.id}-${Date.now()}`,
        quantity: 5,
        tenant: tenantB.id,
        priceInformation: { price: 29.99 },
        priceJSON: JSON.stringify({ id: `price_test_cross_tenant_${tenantB.id}_${w}_${Date.now()}` }),
        skipSync: true,
        stripeProductId: `prod_test_cross_tenant_${tenantB.id}_${w}_${Date.now()}`,
      },
      overrideAccess: true,
    }) as { id: number }

    await payload.update({
      collection: 'event-types',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [cpt.id] } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(11, 0, 0, 0)
    const end = new Date(start)
    end.setHours(12, 0, 0, 0)
    const lesson = await createTestTimeslot(tenantB.id, co.id, start, end, undefined, true)

    await new Promise((r) => setTimeout(r, 500))

    await loginAsRegularUserViaApi(page, user.email, 'password', { tenantSlug: tenantB.slug })

    await navigateToTenant(page, tenantB.slug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await navigateToTenant(page, tenantB.slug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)

    await expect(
      page.getByText(/select quantity|number of slots|book|payment methods/i).first()
    ).toBeVisible({ timeout: 15_000 })

    const classPassTab = page.getByRole('tab', { name: /class pass/i })
    await expect(classPassTab).toBeVisible({ timeout: 15_000 })
    await classPassTab.click()

    await expect(page.getByText(/buy a class pass/i)).toBeVisible({ timeout: 15_000 })
    const buyPassBtn = page.getByRole('button', { name: /buy pass/i }).first()
    await expect(buyPassBtn).toBeVisible({ timeout: 10_000 })

    const expectedCustomerB = `cus_test_${accountB}_${user.id}`

    const checkoutResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/stripe/connect/create-checkout-session') &&
        res.request().method() === 'POST',
      { timeout: process.env.CI ? 30_000 : 15_000 },
    )

    await buyPassBtn.click()

    const checkoutRes = await checkoutResponsePromise
    expect(checkoutRes.ok(), `create-checkout-session failed: ${checkoutRes.status()}`).toBeTruthy()

    const sessionJson = (await checkoutRes.json()) as { id?: string; url?: string | null }
    expect(sessionJson.id ?? '').toMatch(/^cs_test_/)
    expect(sessionJson.url).toBeTruthy()

    await expect
      .poll(
        async () => {
          const refreshed = (await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 0,
            overrideAccess: true,
          })) as {
            stripeCustomers?: Array<{ stripeAccountId?: string; stripeCustomerId?: string }>
          }
          const rows = Array.isArray(refreshed.stripeCustomers) ? refreshed.stripeCustomers : []
          const forB = rows.find((r) => r.stripeAccountId === accountB)
          return forB?.stripeCustomerId ?? null
        },
        { timeout: 10_000 },
      )
      .toBe(expectedCustomerB)

    const finalUser = (await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })) as {
      stripeCustomers?: Array<{ stripeAccountId?: string; stripeCustomerId?: string }>
    }
    const rows = Array.isArray(finalUser.stripeCustomers) ? finalUser.stripeCustomers : []
    expect(rows.some((r) => r.stripeAccountId === accountA && r.stripeCustomerId === priorCustomerA)).toBe(
      true,
    )
    expect(rows.some((r) => r.stripeAccountId === accountB && r.stripeCustomerId === expectedCustomerB)).toBe(
      true,
    )
  })
})

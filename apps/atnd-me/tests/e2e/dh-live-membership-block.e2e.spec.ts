import type { Page } from '@playwright/test'

import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  copySessionCookiesToTenantDomain,
  loginAsRegularUserViaApi,
} from './helpers/auth-helpers'
import {
  createTestPlan,
  createTestSubscription,
  createTestPage,
  getPayloadInstance,
} from './helpers/data-helpers'

/** `dhLiveMembership` is an extra block; Pages `beforeChange` rejects it unless the tenant allows it. */
async function allowDhLiveMembershipBlock(tenantId: number | string) {
  const payload = await getPayloadInstance()
  const id = typeof tenantId === 'string' ? Number(tenantId) : tenantId
  await payload.update({
    collection: 'tenants',
    id,
    data: { allowedBlocks: ['dhLiveMembership'] },
    overrideAccess: true,
  })
}

/** Same session on multiple tenant hosts (registration tenant can differ from the page tenant). */
async function loginWithSessionOnTenantHosts(
  page: Page,
  email: string,
  password: string,
  tenantSlugs: string[],
) {
  await loginAsRegularUserViaApi(page, email, password)
  const cookies = await page.context().cookies()
  for (const slug of tenantSlugs) {
    const sessionOnHost = copySessionCookiesToTenantDomain(cookies, slug)
    if (sessionOnHost.length) {
      await page.context().addCookies(sessionOnHost)
    }
    await page.context().addCookies([
      { name: 'tenant-slug', value: slug, domain: `${slug}.localhost`, path: '/' },
    ])
  }
}

/**
 * DhLiveMembership (darkhorse tenant block) delegates to DashboardMembershipPanel:
 * no active subscription → PlanList + "Subscribe"; active subscription → "Manage Subscription".
 */
test.describe('DhLiveMembership block', () => {
  test('signed-in user without an active subscription sees Subscribe (plan list)', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[0]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    await allowDhLiveMembershipBlock(tenant.id)

    await createTestPlan({
      tenantId: tenant.id,
      name: `Membership E2E List ${workerIndex}`,
      sessions: 4,
      stripeProductId: `prod_mlist_${workerIndex}`,
      priceId: `price_mlist_${workerIndex}`,
    })

    const slug = `membership-list-${workerIndex}`
    await createTestPage(tenant.id, slug, 'Membership', {
      layout: [{ blockType: 'dhLiveMembership', blockName: 'Membership' }],
    })

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    await navigateToTenant(page, tenant.slug, `/${slug}`)
    await page.waitForLoadState('load').catch(() => null)

    await expect(page.getByRole('button', { name: /^subscribe$/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /manage subscription/i })).toHaveCount(0)
  })

  test('signed-in user with an active subscription sees Manage Subscription', async ({
    page,
    testData,
  }) => {
    const tenant = testData.tenants[1]!
    const user = testData.users.user2
    const workerIndex = testData.workerIndex

    await allowDhLiveMembershipBlock(tenant.id)

    const plan = await createTestPlan({
      tenantId: tenant.id,
      name: `Membership E2E Manage ${workerIndex}`,
      sessions: 4,
      stripeProductId: `prod_mmanage_${workerIndex}`,
      priceId: `price_mmanage_${workerIndex}`,
    })

    await createTestSubscription({
      userId: user.id,
      tenantId: tenant.id,
      planId: plan.id,
      status: 'active',
    })

    const slug = `membership-manage-${workerIndex}`
    await createTestPage(tenant.id, slug, 'Membership', {
      layout: [{ blockType: 'dhLiveMembership', blockName: 'Membership' }],
    })

    await loginAsRegularUserViaApi(page, user.email, 'password', {
      tenantSlug: tenant.slug,
    })

    await navigateToTenant(page, tenant.slug, `/${slug}`)
    await page.waitForLoadState('load').catch(() => null)

    await expect(page.getByRole('button', { name: /manage subscription/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /^subscribe$/i })).toHaveCount(0)
  })

  test('registration tenant differs from subscription tenant: Manage on subscription tenant, Subscribe on registration tenant', async ({
    page,
    testData,
  }) => {
    const tenantRegistration = testData.tenants[0]!
    const tenantSubscription = testData.tenants[1]!
    const user = testData.users.user1
    const workerIndex = testData.workerIndex

    const payload = await getPayloadInstance()
    const userDoc = await payload.findByID({
      collection: 'users',
      id: String(user.id),
      depth: 0,
      overrideAccess: true,
    })
    const regTenantId =
      userDoc && typeof userDoc === 'object' && 'registrationTenant' in userDoc
        ? (userDoc as { registrationTenant?: number | null }).registrationTenant
        : null
    expect(regTenantId).toBe(tenantRegistration.id)

    await allowDhLiveMembershipBlock(tenantRegistration.id)
    await allowDhLiveMembershipBlock(tenantSubscription.id)

    await createTestPlan({
      tenantId: tenantRegistration.id,
      name: `Membership E2E Cross Reg ${workerIndex}`,
      sessions: 4,
      stripeProductId: `prod_mcross_reg_${workerIndex}`,
      priceId: `price_mcross_reg_${workerIndex}`,
    })

    const planSub = await createTestPlan({
      tenantId: tenantSubscription.id,
      name: `Membership E2E Cross Sub ${workerIndex}`,
      sessions: 4,
      stripeProductId: `prod_mcross_sub_${workerIndex}`,
      priceId: `price_mcross_sub_${workerIndex}`,
    })

    await createTestSubscription({
      userId: user.id,
      tenantId: tenantSubscription.id,
      planId: planSub.id,
      status: 'active',
    })

    const slugReg = `membership-cross-reg-${workerIndex}`
    const slugSub = `membership-cross-sub-${workerIndex}`

    await createTestPage(tenantRegistration.id, slugReg, 'Membership', {
      layout: [{ blockType: 'dhLiveMembership', blockName: 'Membership' }],
    })
    await createTestPage(tenantSubscription.id, slugSub, 'Membership', {
      layout: [{ blockType: 'dhLiveMembership', blockName: 'Membership' }],
    })

    await loginWithSessionOnTenantHosts(page, user.email, 'password', [
      tenantRegistration.slug,
      tenantSubscription.slug,
    ])

    await navigateToTenant(page, tenantSubscription.slug, `/${slugSub}`)
    await page.waitForLoadState('load').catch(() => null)
    await expect(page.getByRole('button', { name: /manage subscription/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /^subscribe$/i })).toHaveCount(0)

    await navigateToTenant(page, tenantRegistration.slug, `/${slugReg}`)
    await page.waitForLoadState('load').catch(() => null)
    // Multiple active plans ⇒ multiple Subscribe buttons; registration tenant has no subscription for this user.
    await expect(page.getByRole('button', { name: /^subscribe$/i }).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /manage subscription/i })).toHaveCount(0)
  })
})

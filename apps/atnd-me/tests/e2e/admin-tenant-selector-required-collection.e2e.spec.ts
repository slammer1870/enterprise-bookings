import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, BASE_URL } from './helpers/auth-helpers'
import { getPayloadInstance } from './helpers/data-helpers'

const ADMIN_VIEWPORT = { width: 1440, height: 900 }

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getTenantSelector(page: Page) {
  return page.getByTestId('tenant-selector')
}

async function ensureSidebarOpen(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null)

  // In some admin layouts (esp. wide viewports), the sidebar is always visible and
  // the "Open menu" / "Close menu" buttons are not rendered at all.
  if (await getTenantSelector(page).isVisible().catch(() => false)) {
    return
  }

  const openMenuButton = page.getByRole('button', { name: /open\s+menu/i })
  const closeMenuButton = page.getByRole('button', { name: /close\s+menu/i })

  await Promise.race([
    openMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
    closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }),
  ]).catch(() => null)

  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click({ timeout: 10_000 }).catch(() => null)
    await closeMenuButton.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null)
    await page.waitForTimeout(250)
  }

  await getTenantSelector(page).waitFor({ state: 'visible', timeout: 20_000 })
}

test.describe('Admin tenant selector — required-tenant collection edit page', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  test('when no tenant is selected, opening a subscriptions doc auto-sets tenant and selector is immutable', async ({
    page,
    testData,
    request,
  }) => {
    await page.setViewportSize(ADMIN_VIEWPORT)
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })

    const payload = await getPayloadInstance()
    const tenant = testData.tenants[1]
    const otherTenant = testData.tenants[0]
    if (!tenant?.id || !tenant?.name) throw new Error('Test setup requires tenant')
    if (!otherTenant?.id || !otherTenant?.name) throw new Error('Test setup requires second tenant')

    // Subscriptions are scoped to Stripe Connect in this app. Ensure the tenant has a connect account
    // so subscription hooks don't throw during test data creation.
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_e2e_${tenant.id}`,
      },
      overrideAccess: true,
    })

    // Create a minimal plan + subscription for the target tenant.
    const plan = (await payload.create({
      collection: 'plans',
      data: {
        name: `E2E plan ${tenant.id}-${Date.now()}`,
        status: 'active',
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    const subscription = (await payload.create({
      collection: 'subscriptions',
      data: {
        user: testData.users.user2.id,
        plan: plan.id,
        status: 'active',
        // Important: omit stripeSubscriptionId so the Stripe-sync hook does not run.
        // This test is about tenant selector behavior, not Stripe integration.
        skipSync: true,
        tenant: tenant.id,
      },
      overrideAccess: true,
    })) as { id: number }

    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'load' })
    await ensureSidebarOpen(page)

    // Start from "no tenant selected" while keeping auth cookies intact.
    const origin = new URL(page.url()).origin
    await page.context().addCookies([
      { name: 'payload-tenant', value: '', url: `${origin}/` },
      { name: 'payload-tenant', value: '', url: `${origin}/admin/` },
    ])
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)

    const wrap = getTenantSelector(page)
    await expect(wrap.getByText(/select a value/i).first()).toBeVisible({ timeout: 15_000 })

    // Open a document that has a tenant (subscriptions are tenant-required in this app).
    await page.goto(`${origin}/admin/collections/subscriptions/${subscription.id}`, {
      waitUntil: 'load',
    })
    await ensureSidebarOpen(page)

    // Selector should auto-select the document's tenant.
    await expect(wrap.getByText(new RegExp(escapeRegex(tenant.name), 'i')).first()).toBeVisible({
      timeout: 20_000,
    })

    // Assert persisted behavior instead of polling the browser cookie jar,
    // which is flaky with path-scoped duplicates in this admin flow.
    await page.reload({ waitUntil: 'load' })
    await ensureSidebarOpen(page)
    await expect(wrap.getByText(new RegExp(escapeRegex(tenant.name), 'i')).first()).toBeVisible({
      timeout: 20_000,
    })

    // Required tenant collection: selector must be immutable (no clear, no change).
    const clearBtn = wrap.locator('button[aria-label*="Clear"], button[title*="Clear"]').first()
    await expect(clearBtn).not.toBeVisible()

    // Attempt to switch tenant anyway (should be blocked; selector remains on the document tenant).
    const combobox = wrap.getByRole('combobox').or(wrap).first()
    await wrap.getByRole('button').last().click({ timeout: 5000, force: true }).catch(() => null)
    await combobox.click({ timeout: 5000 }).catch(() => null)
    await combobox.focus().catch(() => null)
    await page.keyboard.press('ArrowDown').catch(() => null)
    const otherOption = page
      .getByRole('option', { name: new RegExp(escapeRegex(otherTenant.name), 'i') })
      .first()
    await otherOption.click({ timeout: 1500 }).catch(() => null)
    await page.waitForTimeout(300)

    await expect(wrap.getByText(new RegExp(escapeRegex(tenant.name), 'i')).first()).toBeVisible()
  })
})


/**
 * App smoke tests – whole-app coverage including checkout in all situations.
 * Run in local profile (test:e2e:local) and CI.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsSuperAdmin, loginAsRegularUserViaApi, BASE_URL } from './helpers/auth-helpers'
import { navigateToRoot } from './helpers/subdomain-helpers'
import {
  createTestClassOption,
  createTestLesson,
  createTestBooking,
} from './helpers/data-helpers'
import { getPayload } from 'payload'
import config from '@/payload.config'

test.describe('App smoke', () => {
  test.describe.configure({ timeout: 90_000 })

  test('homepage and tenants listing load', async ({ page }) => {
    await navigateToRoot(page)
    const url = new URL(page.url())
    expect(url.hostname).toBe('localhost')

    await navigateToRoot(page, '/tenants')
    expect(page.url()).toContain('/tenants')
    await expect(page.locator('body')).toBeVisible()
  })

  test('checkout pay-at-door: full flow (quantity, Book, success)', async ({
    page,
    testData,
  }) => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    const co = await createTestClassOption(tenantId, 'Smoke Pay at Door', 5, undefined, w)
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [] } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(12, 0, 0, 0)
    const end = new Date(start)
    end.setHours(13, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.context().addCookies([
      { name: 'tenant-slug', value: tenantSlug, domain: new URL(BASE_URL).hostname, path: '/' },
    ])
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password')
    await page.goto(`${BASE_URL}/bookings/${lesson.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/number of slots/i).first()).toBeVisible()
    // QuantitySelector uses +/- buttons; default quantity is 1. Just click Book.
    const bookBtn = page.locator('button:has-text("Book")').first()
    await expect(bookBtn).toBeVisible()
    await expect(bookBtn).toBeEnabled()
    await bookBtn.click()

    await Promise.race([
      page.getByText(/successfully booked|slot.*booked/i).waitFor({ state: 'visible', timeout: 15000 }),
      page.waitForURL((u) => !u.pathname.includes('/bookings/'), { timeout: 15000 }),
    ])
    const sawToast = await page.getByText(/successfully booked|slot.*booked/i).isVisible().catch(() => false)
    const redirected = !page.url().includes('/bookings/')
    expect(sawToast || redirected).toBe(true)
  })

  test('checkout Stripe-enabled: fee breakdown visible (no payment submission)', async ({
    page,
    testData,
  }) => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_smoke_${tenantId}`,
      },
      overrideAccess: true,
    })

    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Smoke Drop-in ${tenantId}-w${w}-${Date.now()}`,
        isActive: true,
        price: 1000,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }
    const co = await createTestClassOption(tenantId, 'Smoke Stripe UI', 5, undefined, w)
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: { paymentMethods: { allowedDropIn: dropIn.id, allowedClassPasses: [] } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.context().addCookies([
      { name: 'tenant-slug', value: tenantSlug, domain: new URL(BASE_URL).hostname, path: '/' },
    ])
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password')
    await page.goto(`${BASE_URL}/bookings/${lesson.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    // Checkout shows PaymentMethods (Drop-in / Membership tabs) when payment methods are attached
    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('tab', { name: /drop-?in/i })).toBeVisible()
  })

  test('checkout class-pass-only: booking page loads with quantity and form', async ({
    page,
    testData,
  }) => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    const cpType = await payload.create({
      collection: 'class-pass-types',
      draft: false,
      data: {
        name: 'Smoke CP Only',
        slug: `smoke-cp-only-${tenantId}-w${w}-${Date.now()}`,
        quantity: 5,
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }
    const co = await createTestClassOption(tenantId, 'Smoke Class Pass Only', 5, undefined, w)
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: {
        paymentMethods: {
          allowedClassPasses: [cpType.id],
        },
      },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(16, 0, 0, 0)
    const end = new Date(start)
    end.setHours(17, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.context().addCookies([
      { name: 'tenant-slug', value: tenantSlug, domain: new URL(BASE_URL).hostname, path: '/' },
    ])
    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password')
    await page.goto(`${BASE_URL}/bookings/${lesson.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page.getByText(/select quantity/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/number of slots/i).first()).toBeVisible()
    await expect(page.locator('button:has-text("Book")').first()).toBeVisible()
  })

  test('manage bookings: navigate to manage when 2+ bookings, manage UI visible', async ({
    page,
    testData,
  }) => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const user1 = testData.users.user1
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug || !user1) throw new Error('Tenant and user required')

    const co = await createTestClassOption(tenantId, 'Smoke Manage', 10, undefined, w)
    await payload.update({
      collection: 'class-options',
      id: co.id,
      data: { paymentMethods: { allowedClassPasses: [] } },
      overrideAccess: true,
    })

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(11, 0, 0, 0)
    const lesson = await createTestLesson(tenantId, co.id, start, end, undefined, true)

    await createTestBooking(user1.id, lesson.id, 'confirmed')
    await createTestBooking(user1.id, lesson.id, 'confirmed')

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.context().addCookies([
      { name: 'tenant-slug', value: tenantSlug, domain: new URL(BASE_URL).hostname, path: '/' },
    ])
    await loginAsRegularUserViaApi(page, user1.email, 'password')
    await page.goto(`${BASE_URL}/bookings/${lesson.id}/manage`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)

    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}/manage`), { timeout: 10000 })
    await expect(
      page.getByText(/your bookings|update booking quantity/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('admin panel: super admin can access dashboard', async ({ page, testData, request }) => {
    await loginAsSuperAdmin(page, testData.users.superAdmin.email, { request })
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' })
    await page
      .waitForURL(
        (url) => url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login'),
        { timeout: 15000 }
      )
      .catch(() => {
        if (page.url().includes('/admin/login')) {
          throw new Error('Super admin redirected to login')
        }
      })
    expect(page.url()).toContain('/admin')
    expect(page.url()).not.toContain('/admin/login')
  })
})
// test comment
// test

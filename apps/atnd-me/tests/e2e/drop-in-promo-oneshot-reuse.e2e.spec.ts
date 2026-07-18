/**
 * Regression: drop-ins apply promos outside Stripe, so maxRedemptions must be
 * enforced locally. A maxRedemptions=1 code must work once, then be rejected.
 */
import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  ensureTenantDropInPlatformFeePercent,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Drop-in one-shot promo reuse', () => {
  test.describe.configure({ timeout: 120_000 })

  test('maxRedemptions=1 code can be used once, then Apply and validate reject reuse', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const userId = testData.users.user1.id
    const workerIndex = testData.workerIndex

    if (!tenantId || !tenantSlug || !userId) {
      throw new Error('Tenant or user fixture is missing for one-shot promo reuse test')
    }

    await ensureTenantDropInPlatformFeePercent(tenantId, 2)

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_oneshot_${tenantId}`,
      },
      overrideAccess: true,
    })

    const promoCode = `ONCE${tenantId}${workerIndex}`.slice(0, 24).toUpperCase()
    const discount = await payload.create({
      collection: 'discount-codes',
      data: {
        name: `One-shot reuse ${tenantId}-${workerIndex}`,
        code: promoCode,
        type: 'percentage_off',
        value: 100,
        duration: 'once',
        maxRedemptions: 1,
        timesRedeemed: 0,
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E One-shot Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 12,
        adjustable: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenantId,
      'One-shot Promo Class',
      5,
      undefined,
      workerIndex,
    )
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const makeLesson = async (dayOffset: number, hour: number) => {
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + dayOffset)
      startTime.setHours(hour, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(hour + 1, 0, 0, 0)
      return createTestTimeslot(tenantId, classOption.id, startTime, endTime, undefined, true)
    }

    const lesson1 = await makeLesson(1, 11)
    const lesson2 = await makeLesson(2, 14)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    // ── First booking: code applies and completes ──────────────────────────
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson1.id}`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson1.id}$`), { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('tab', { name: /drop-?in/i }).click()

    const zeroAmountIntent = page.waitForResponse(
      (res) => {
        if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
        const req = res.request()
        if (req.method() !== 'POST') return false
        const postData = req.postData()
        if (!postData) return false
        try {
          const body = JSON.parse(postData) as { price?: number; confirmOnly?: boolean }
          return body.price === 0 && body.confirmOnly !== true
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )

    await page.getByLabel('Promo code').fill(promoCode)
    await page.getByRole('button', { name: /^Apply$/i }).click()
    await Promise.all([
      expect(page.getByText(/promo code applied/i)).toBeVisible({ timeout: 15_000 }),
      zeroAmountIntent,
    ])

    const confirmResponsePromise = page.waitForResponse(
      (res) => {
        if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
        const req = res.request()
        if (req.method() !== 'POST') return false
        const postData = req.postData()
        if (!postData) return false
        try {
          return JSON.parse(postData).confirmOnly === true
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )

    await expect(page.getByTestId('complete-free-booking')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('complete-free-booking').click()

    const [confirmRes] = await Promise.all([
      confirmResponsePromise,
      page.waitForURL(/\/success\?/, { timeout: 20_000 }),
    ])
    expect(confirmRes.ok()).toBeTruthy()

    const afterFirst = await payload.findByID({
      collection: 'discount-codes',
      id: discount.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterFirst.timesRedeemed).toBe(1)
    expect(afterFirst.status).toBe('archived')

    // ── Validate API rejects reuse ─────────────────────────────────────────
    const validateRes = await request.post('/api/stripe/connect/validate-discount-code', {
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': String(tenantId),
      },
      data: {
        discountCode: promoCode,
        metadata: { tenantId: String(tenantId), timeslotId: String(lesson2.id) },
      },
    })
    expect(validateRes.status()).toBe(400)
    await expect(validateRes.json()).resolves.toMatchObject({
      error: 'This discount code has already been used.',
    })

    // ── UI Apply on a second timeslot also rejects ─────────────────────────
    await navigateToTenant(page, tenantSlug, `/bookings/${lesson2.id}`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson2.id}$`), { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /payment methods/i })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('tab', { name: /drop-?in/i }).click()

    await page.getByLabel('Promo code').fill(promoCode)
    await page.getByRole('button', { name: /^Apply$/i }).click()
    await expect(page.getByText(/already been used/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/promo code applied/i)).toHaveCount(0)
  })
})

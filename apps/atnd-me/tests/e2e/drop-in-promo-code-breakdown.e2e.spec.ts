import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Drop-in promo code breakdown', () => {
  test.describe.configure({ timeout: 90_000 })

  test('applied promo code updates the price breakdown and totals', async ({
    page,
    testData,
    request,
  }) => {
    const payload = await getPayloadInstance()

    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const workerIndex = testData.workerIndex

    if (!tenantId || !tenantSlug) {
      throw new Error('Tenant ID or slug is missing from test data')
    }

    const platformFees = (await payload.findGlobal({
      slug: 'platform-fees',
      depth: 0,
      overrideAccess: true,
    })) as { defaults?: object; overrides?: Array<{ tenant: number; dropInPercent?: number }> } | null
    const overrides = platformFees?.overrides ?? []
    const existingIdx = overrides.findIndex((override) => override.tenant === tenantId)
    const nextOverrides =
      existingIdx >= 0
        ? overrides.map((override, index) =>
            index === existingIdx ? { ...override, dropInPercent: 10 } : override
          )
        : [...overrides, { tenant: tenantId, dropInPercent: 10 }]

    await payload.updateGlobal({
      slug: 'platform-fees',
      data: {
        defaults:
          platformFees?.defaults ?? {
            dropInPercent: 2,
            classPassPercent: 3,
            subscriptionPercent: 4,
          },
        overrides: nextOverrides,
      },
      depth: 0,
      overrideAccess: true,
    } as Parameters<typeof payload.updateGlobal>[0])

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_dropin_promo_${tenantId}`,
      },
      overrideAccess: true,
    })

    const promoCode = `SAVE${tenantId}${workerIndex}`.slice(0, 24).toUpperCase()
    await payload.create({
      collection: 'discount-codes',
      data: {
        name: `Drop-in promo ${tenantId}-${workerIndex}`,
        code: promoCode,
        type: 'percentage_off',
        value: 20,
        duration: 'once',
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Promo Breakdown Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: 10,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: tenantId,
      },
      overrideAccess: true,
    }) as { id: number }

    const classOption = await createTestEventType(tenantId, 'Promo Breakdown Class', 5, undefined, workerIndex)
    await payload.update({
      collection: 'event-types',
      id: classOption.id,
      data: {
        paymentMethods: { allowedDropIn: dropIn.id },
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 1)
    startTime.setHours(12, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)
    const lesson = await createTestTimeslot(tenantId, classOption.id, startTime, endTime, undefined, true)

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    await navigateToTenant(page, tenantSlug, '/')
    await page.waitForLoadState('domcontentloaded').catch(() => null)
    await page.waitForURL((url) => url.pathname === '/home', { timeout: 10_000 }).catch(() => null)

    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => null)

    await expect(page.getByText(/payment methods/i).first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: /drop-?in/i }).click()

    await expect(page.getByTestId('booking-fee-breakdown')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('class-price')).toHaveText('€10.00')
    await expect(page.getByTestId('booking-fee')).toHaveText('€1.00')
    await expect(page.getByTestId('total')).toHaveText('€11.00')

    const discountedRequestPromise = page.waitForRequest(
      (req) => {
        if (!req.url().includes('create-payment-intent')) return false
        if (req.method() !== 'POST') return false
        try {
          const body = req.postDataJSON() as { price?: unknown; metadata?: Record<string, unknown> }
          return Number(body?.price) === 8 && body?.metadata?.discountCode === promoCode
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )
    const discountedIntentOk = page.waitForResponse(
      async (res) => {
        if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
        if (res.request().method() !== 'POST' || res.status() !== 200) return false
        const postData = res.request().postData()
        if (!postData) return false
        try {
          const body = JSON.parse(postData) as { price?: number; metadata?: Record<string, unknown> }
          return Number(body.price) === 8 && body.metadata?.discountCode === promoCode
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )

    await page.getByLabel('Promo code').fill(promoCode)
    await Promise.all([
      discountedRequestPromise,
      discountedIntentOk,
      page.getByRole('button', { name: /^Apply$/i }).click(),
    ])

    await expect(page.getByText(/promo code applied/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('class-price')).toHaveText('€10.00')
    await expect(page.getByTestId('promo-discount')).toHaveText('-€2.00')
    await expect(page.getByTestId('booking-fee')).toHaveText('€0.80')
    await expect(page.getByTestId('total')).toHaveText('€8.80')
    await expect(page.getByTestId('payment-total')).toHaveText('€8.80', { timeout: 5_000 })
  })
})

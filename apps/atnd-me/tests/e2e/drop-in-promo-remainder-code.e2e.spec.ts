import { test, expect } from './helpers/fixtures'
import { loginAsRegularUserViaApi } from './helpers/auth-helpers'
import { navigateToTenant } from './helpers/subdomain-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  ensureTenantDropInPlatformFeePercent,
  getPayloadInstance,
} from './helpers/data-helpers'
import { addYearsIso } from '../../src/lib/stripe-connect/giftVoucherImport'

test.describe('Drop-in promo remainder code', () => {
  test.describe.configure({ timeout: 90_000 })

  test('amount_off maxRedemptions=1 leftover issues a new code with root+5y expiry', async ({
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
      throw new Error('Tenant or user fixture is missing for remainder promo test')
    }

    await ensureTenantDropInPlatformFeePercent(tenantId, 2)

    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: `acct_rem_${tenantId}`,
      },
      overrideAccess: true,
    })

    const rootPurchasedAt = '2026-01-15T12:00:00.000Z'
    const expectedRedeemBy = addYearsIso(rootPurchasedAt, 5)
    const promoCode = `REM${tenantId}${workerIndex}`.slice(0, 24).toUpperCase()
    const classPrice = 19

    const parent = await payload.create({
      collection: 'discount-codes',
      data: {
        name: `Remainder parent ${tenantId}-${workerIndex}`,
        code: promoCode,
        type: 'amount_off',
        value: 30,
        currency: 'eur',
        duration: 'once',
        maxRedemptions: 1,
        rootPurchasedAt,
        redeemBy: expectedRedeemBy,
        tenant: tenantId,
      },
      overrideAccess: true,
    })

    const dropIn = (await payload.create({
      collection: 'drop-ins',
      data: {
        name: `E2E Remainder Drop-in ${tenantId}-${Date.now()}`,
        isActive: true,
        price: classPrice,
        adjustable: true,
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as { id: number }

    const classOption = await createTestEventType(
      tenantId,
      'Remainder Promo Class',
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

    const startTime = new Date()
    startTime.setDate(startTime.getDate() + 1)
    startTime.setHours(12, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(13, 0, 0, 0)
    const lesson = await createTestTimeslot(
      tenantId,
      classOption.id,
      startTime,
      endTime,
      undefined,
      true,
    )

    await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
      request,
      tenantSlug,
    })

    await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
    await expect(page).toHaveURL(new RegExp(`/bookings/${lesson.id}$`), { timeout: 30_000 })
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

    // Prefer DB as source of truth — response body can be dropped after navigation.
    const remainders = await payload.find({
      collection: 'discount-codes',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { parentDiscountCode: { equals: parent.id } },
        ],
      },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })

    expect(remainders.totalDocs).toBe(1)
    const child = remainders.docs[0] as {
      code?: string
      value?: number
      maxRedemptions?: number
      rootPurchasedAt?: string
      redeemBy?: string
    }
    expect(child.code).toMatch(/^[A-Z0-9]{3,24}$/)
    expect(child.value).toBe(11)
    expect(child.maxRedemptions).toBe(1)
    expect(new Date(child.rootPurchasedAt ?? '').toISOString()).toBe(
      new Date(rootPurchasedAt).toISOString(),
    )
    expect(new Date(child.redeemBy ?? '').toISOString()).toBe(
      new Date(expectedRedeemBy).toISOString(),
    )

    // Parent one-shot code must be consumed so it cannot be reused on another drop-in.
    const parentAfter = await payload.findByID({
      collection: 'discount-codes',
      id: parent.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(parentAfter.timesRedeemed).toBe(1)
    expect(parentAfter.status).toBe('archived')
    expect(parentAfter.lastConsumedHoldId).toBeTruthy()
  })

  for (const caseConfig of [
    {
      name: 'multi-use (maxRedemptions: 5)',
      codePrefix: 'MULTI',
      maxRedemptions: 5 as number | null,
      accountPrefix: 'acct_remm_',
      eventSuffix: 1000,
    },
    {
      name: 'unlimited (maxRedemptions omitted)',
      codePrefix: 'UNLIM',
      maxRedemptions: null,
      accountPrefix: 'acct_remu_',
      eventSuffix: 2000,
    },
  ]) {
    test(`${caseConfig.name} amount_off does not issue a remainder code`, async ({
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
        throw new Error('Tenant or user fixture is missing')
      }

      await ensureTenantDropInPlatformFeePercent(tenantId, 2)
      await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: `${caseConfig.accountPrefix}${tenantId}`,
        },
        overrideAccess: true,
      })

      const promoCode = `${caseConfig.codePrefix}${tenantId}${workerIndex}`.slice(0, 24).toUpperCase()
      const parent = await payload.create({
        collection: 'discount-codes',
        data: {
          name: `${caseConfig.name} ${tenantId}-${workerIndex}`,
          code: promoCode,
          type: 'amount_off',
          value: 30,
          currency: 'eur',
          duration: 'once',
          ...(caseConfig.maxRedemptions != null
            ? { maxRedemptions: caseConfig.maxRedemptions }
            : {}),
          rootPurchasedAt: '2026-01-15T12:00:00.000Z',
          tenant: tenantId,
        },
        overrideAccess: true,
      })

      const dropIn = (await payload.create({
        collection: 'drop-ins',
        data: {
          name: `E2E ${caseConfig.codePrefix} Drop-in ${tenantId}-${Date.now()}`,
          isActive: true,
          price: 19,
          adjustable: true,
          tenant: tenantId,
        },
        overrideAccess: true,
      })) as { id: number }

      const classOption = await createTestEventType(
        tenantId,
        `${caseConfig.codePrefix} Promo Class`,
        5,
        undefined,
        workerIndex + caseConfig.eventSuffix,
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

      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 2)
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)
      const lesson = await createTestTimeslot(
        tenantId,
        classOption.id,
        startTime,
        endTime,
        undefined,
        true,
      )

      await loginAsRegularUserViaApi(page, testData.users.user1.email, 'password', {
        request,
        tenantSlug,
      })
      await navigateToTenant(page, tenantSlug, `/bookings/${lesson.id}`)
      await page.getByRole('tab', { name: /drop-?in/i }).click()

      await page.getByLabel('Promo code').fill(promoCode)
      await page.getByRole('button', { name: /^Apply$/i }).click()
      await expect(page.getByText(/promo code applied/i)).toBeVisible({ timeout: 15_000 })

      const confirmResponsePromise = page.waitForResponse(
        (res) => {
          if (!res.url().includes('/api/stripe/connect/create-payment-intent')) return false
          const postData = res.request().postData()
          if (!postData) return false
          try {
            return JSON.parse(postData).confirmOnly === true
          } catch {
            return false
          }
        },
        { timeout: 30_000 },
      )

      await page.getByTestId('complete-free-booking').click()
      const [confirmRes] = await Promise.all([
        confirmResponsePromise,
        page.waitForURL(/\/success\?/, { timeout: 20_000 }),
      ])
      expect(confirmRes.ok()).toBeTruthy()

      const remainders = await payload.find({
        collection: 'discount-codes',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { parentDiscountCode: { equals: parent.id } },
          ],
        },
        limit: 5,
        depth: 0,
        overrideAccess: true,
      })
      expect(remainders.totalDocs).toBe(0)
    })
  }
})

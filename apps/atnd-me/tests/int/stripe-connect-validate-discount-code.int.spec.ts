import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { NextRequest } from 'next/server'

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    coupons: {
      create: vi.fn().mockResolvedValue({ id: 'coupon_mock_validate' }),
    },
    promotionCodes: {
      create: vi.fn().mockResolvedValue({ id: 'promo_mock_validate' }),
      update: vi.fn().mockResolvedValue({ id: 'promo_mock_validate' }),
    },
  }),
}))

import { POST } from '@/app/api/stripe/connect/validate-discount-code/route'

const TEST_TIMEOUT = 60000
const HOOK_TIMEOUT = 300000
const runId = Math.random().toString(36).slice(2, 10)

describe('validate-discount-code API route', () => {
  let payload: Payload
  let regularUser: User
  let activeTenantId: number
  let activeDiscountCodeId: number
  let activeAmountDiscountCodeId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Validate Discount Route User',
        email: `validate-discount-${runId}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const activeTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Validate Discount Tenant Active',
        slug: `validate-discount-tenant-${runId}`,
        stripeConnectAccountId: `acct_validate_discount_${runId}`,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    activeTenantId = activeTenant.id as number

    const discountCode = await payload.create({
      collection: 'discount-codes',
      data: {
        name: 'Validate Discount Route Discount',
        code: `SAVE${runId}`.slice(0, 24).toUpperCase(),
        type: 'percentage_off',
        value: 20,
        duration: 'once',
        tenant: activeTenantId,
      },
      overrideAccess: true,
    })
    activeDiscountCodeId = discountCode.id as number

    const amountDiscountCode = await payload.create({
      collection: 'discount-codes',
      data: {
        name: 'Validate Discount Route Amount Discount',
        code: `AMT${runId}`.slice(0, 24).toUpperCase(),
        type: 'amount_off',
        value: 10.5,
        currency: 'eur',
        duration: 'once',
        tenant: activeTenantId,
      },
      overrideAccess: true,
    })
    activeAmountDiscountCodeId = amountDiscountCode.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { in: [regularUser.id] } },
        })
        await payload.delete({
          collection: 'discount-codes',
          where: { id: { in: [activeDiscountCodeId, activeAmountDiscountCodeId] } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: activeTenantId } },
        })
      } catch {
        // ignore cleanup failures
      }
      await payload.db?.destroy?.()
    }
  })

  function request(body?: Record<string, unknown> | null) {
    return new NextRequest('http://localhost:3000/api/stripe/connect/validate-discount-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': String(activeTenantId), 'x-test-user-id': String(regularUser.id) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  it(
    'validates an active tenant discount code',
    async () => {
      const discountCode = await payload.findByID({
        collection: 'discount-codes',
        id: activeDiscountCodeId,
        overrideAccess: true,
      })

      const res = await POST(request({ discountCode: discountCode.code }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        valid: true,
        discountCode: discountCode.code,
        discount: {
          type: 'percentage_off',
          value: 20,
          currency: null,
        },
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects invalid discount codes',
    async () => {
      const res = await POST(request({ discountCode: 'NOTREAL' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body).toMatchObject({ error: 'Invalid or inactive discount code.' })
    },
    TEST_TIMEOUT,
  )

  it(
    'returns amount-off discounts in currency units',
    async () => {
      const discountCode = await payload.findByID({
        collection: 'discount-codes',
        id: activeAmountDiscountCodeId,
        overrideAccess: true,
      })

      const res = await POST(request({ discountCode: discountCode.code }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        valid: true,
        discountCode: discountCode.code,
        discount: {
          type: 'amount_off',
          value: 10.5,
          currency: 'eur',
        },
      })
    },
    TEST_TIMEOUT,
  )
})

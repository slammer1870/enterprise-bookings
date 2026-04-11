/**
 * Phase 4.5 – Discount codes: create with tenant Connect → doc has stripeCouponId and stripePromotionCodeId; list/read tenant-scoped.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    coupons: {
      create: vi.fn().mockResolvedValue({ id: 'coupon_mock_dc' }),
    },
    promotionCodes: {
      create: vi.fn().mockResolvedValue({ id: 'promo_mock_dc' }),
      update: vi.fn().mockResolvedValue({ id: 'promo_mock_dc' }),
    },
  }),
}))

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)

describe('Discount codes (Phase 4.5)', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let tenantWithConnectId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin Discount Codes',
        email: `admin-dc-${Date.now()}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Discount Codes Tenant',
        slug: `dc-tenant-${Date.now()}`,
        stripeConnectAccountId: `acct_dc_${runId}`,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantWithConnectId = tenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin DC',
        email: `ta-dc-${Date.now()}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenantWithConnectId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { in: [adminUser.id, tenantAdminUser.id] } },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: tenantWithConnectId } },
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'create discount code (tenant with Connect) → doc has stripeCouponId and stripePromotionCodeId',
    async () => {
      const code = `TEST${Date.now()}`.slice(0, 24)
      const created = await payload.create({
        collection: 'discount-codes',
        data: {
          name: 'Test 20% Off',
          code,
          type: 'percentage_off',
          value: 20,
          duration: 'once',
          tenant: tenantWithConnectId,
        },
        overrideAccess: true,
        user: adminUser,
      } as Parameters<typeof payload.create>[0])
      // afterChange hook sets Stripe IDs via update; re-fetch to get them
      const doc = (await payload.findByID({
        collection: 'discount-codes',
        id: created.id,
        overrideAccess: true,
      })) as Record<string, unknown>
      expect(doc.stripeCouponId).toBe('coupon_mock_dc')
      expect(doc.stripePromotionCodeId).toBe('promo_mock_dc')
      await payload.delete({
        collection: 'discount-codes',
        id: created.id,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'list discount codes is tenant-scoped (tenant-admin sees only own)',
    async () => {
      const list = await payload.find({
        collection: 'discount-codes',
        user: tenantAdminUser,
        overrideAccess: false,
      })
      list.docs.forEach((d) => {
        const t = (d as Record<string, unknown>).tenant
        const tenantId = typeof t === 'object' && t !== null && 'id' in t ? (t as { id: number }).id : t
        expect(tenantId).toBe(tenantWithConnectId)
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'keeps Stripe-immutable fields unchanged after sync while allowing local-only updates',
    async () => {
      const created = await payload.create({
        collection: 'discount-codes',
        data: {
          name: 'Lock Test',
          code: `LOCK${Date.now()}`.slice(0, 24),
          type: 'percentage_off',
          value: 20,
          duration: 'once',
          tenant: tenantWithConnectId,
        },
        overrideAccess: true,
        user: adminUser,
      } as Parameters<typeof payload.create>[0])

      await payload.update({
        collection: 'discount-codes',
        id: created.id,
        data: {
          name: 'Renamed Lock Test',
          code: 'SHOULDNOTAPPLY',
          value: 50,
          duration: 'forever',
          maxRedemptions: 99,
        },
        overrideAccess: true,
        user: adminUser,
      } as Parameters<typeof payload.update>[0])

      const updated = await payload.findByID({
        collection: 'discount-codes',
        id: created.id,
        overrideAccess: true,
      })

      expect(updated.name).toBe('Renamed Lock Test')
      expect(updated.code).toBe(created.code)
      expect(updated.value).toBe(created.value)
      expect(updated.duration).toBe(created.duration)
      expect(updated.maxRedemptions).toBe(created.maxRedemptions)

      await payload.delete({
        collection: 'discount-codes',
        id: created.id,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})

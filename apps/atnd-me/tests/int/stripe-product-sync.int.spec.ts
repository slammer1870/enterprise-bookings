/**
 * Phase 4.5 – Stripe product sync: create plan/class-pass-type (tenant with Connect) → doc has stripeProductId; update syncs; archive on delete.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { getPlatformStripe } from '@/lib/stripe/platform'

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: vi.fn(),
}))

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Stripe product sync (Phase 4.5)', () => {
  let payload: Payload
  let adminUser: User
  let tenantWithConnectId: number
  let tenantWithoutConnectId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin Product Sync',
        email: `admin-sync-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const tenantWith = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Tenant With Connect',
        slug: `with-connect-${Date.now()}`,
        stripeConnectAccountId: 'acct_sync_test',
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantWithConnectId = tenantWith.id as number

    const tenantWithout = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Tenant Without Connect',
        slug: `no-connect-${Date.now()}`,
        stripeConnectOnboardingStatus: 'not_connected',
      },
      overrideAccess: true,
    })
    tenantWithoutConnectId = tenantWithout.id as number

    vi.mocked(getPlatformStripe).mockReturnValue({
      products: {
        create: vi.fn().mockResolvedValue({ id: 'prod_sync_1', default_price: 'price_sync_1' }),
        update: vi.fn().mockResolvedValue({ id: 'prod_sync_1' }),
      },
      prices: {
        create: vi.fn().mockResolvedValue({ id: 'price_sync_1' }),
      },
    } as never)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({ collection: 'users', where: { id: { equals: adminUser.id } } })
        await payload.delete({
          collection: 'tenants',
          where: { id: { in: [tenantWithConnectId, tenantWithoutConnectId] } },
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'create plan with tenant Connect → doc has stripeProductId',
    async () => {
      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: 'Sync Test Plan',
          tenant: tenantWithConnectId,
          priceInformation: { price: 9.99, interval: 'month', intervalCount: 1 },
        },
        overrideAccess: true,
        user: adminUser,
      } as Parameters<typeof payload.create>[0])
      const doc = plan as Record<string, unknown>
      expect(doc.stripeProductId).toBe('prod_sync_1')
      await payload.delete({
        collection: 'plans',
        id: plan.id,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'create class-pass-type with tenant Connect → doc has stripeProductId',
    async () => {
      const cpt = await payload.create({
        collection: 'class-pass-types',
        data: {
          name: 'Sync Test Pass',
          slug: `sync-pass-${Date.now()}`,
          quantity: 10,
          tenant: tenantWithConnectId,
          priceInformation: { price: 49.99 },
        },
        overrideAccess: true,
        user: adminUser,
      } as Parameters<typeof payload.create>[0])
      const doc = cpt as Record<string, unknown>
      expect(doc.stripeProductId).toBe('prod_sync_1')
      await payload.delete({
        collection: 'class-pass-types',
        id: cpt.id,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'create plan with skipSync context → no Stripe create',
    async () => {
      await payload.create({
        collection: 'plans',
        data: {
          name: 'Skip Sync Plan',
          tenant: tenantWithConnectId,
          priceInformation: { price: 5, interval: 'month', intervalCount: 1 },
          skipSync: true,
        },
        overrideAccess: true,
        user: adminUser,
        context: { skipStripeSync: true },
      } as Parameters<typeof payload.create>[0])
      const planList = await payload.find({
        collection: 'plans',
        where: { name: { equals: 'Skip Sync Plan' } },
        overrideAccess: true,
      })
      const created = planList.docs[0]
      expect(created).toBeDefined()
      expect((created as Record<string, unknown>).stripeProductId).toBeFalsy()
      if (created) {
        await payload.delete({
          collection: 'plans',
          id: created.id,
          overrideAccess: true,
        })
      }
    },
    TEST_TIMEOUT,
  )
})

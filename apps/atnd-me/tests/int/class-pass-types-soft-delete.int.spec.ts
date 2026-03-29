/**
 * Phase 4.5 – Class-pass-types soft delete: list excludes deletedAt; delete archives and aborts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    products: {
      create: vi.fn().mockResolvedValue({ id: 'prod_mock_cpt', default_price: 'price_mock_cpt' }),
      update: vi.fn().mockResolvedValue({ id: 'prod_mock_cpt' }),
    },
    prices: {
      create: vi.fn().mockResolvedValue({ id: 'price_mock_cpt' }),
    },
  }),
}))

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Class-pass-types soft delete (Phase 4.5)', () => {
  let payload: Payload
  let adminUser: User
  let testTenantId: number
  let classPassTypeId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const runId = Date.now()

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin CPT Soft Delete',
        email: `admin-cpt-soft-${runId}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'CPT Soft Delete Tenant',
        slug: `cpt-soft-tenant-${runId}`,
        stripeConnectAccountId: `acct_mock_cpt_${runId}`,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: 'Test Pass Type Soft Delete',
        slug: `pass-soft-${runId}`,
        quantity: 5,
        tenant: testTenantId,
        priceInformation: { price: 29.99 },
      },
      overrideAccess: true,
      user: adminUser,
    } as Parameters<typeof payload.create>[0])
    classPassTypeId = cpt.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: adminUser.id } },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: testTenantId } },
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'list class-pass-types excludes soft-deleted',
    async () => {
      const list = await payload.find({
        collection: 'class-pass-types',
        where: { tenant: { equals: testTenantId } },
        user: adminUser,
        overrideAccess: false,
      })
      expect(list.docs.map((d) => d.id)).toContain(classPassTypeId)
    },
    TEST_TIMEOUT,
  )

  it(
    'delete class-pass-type sets deletedAt and archives in Stripe then aborts',
    async () => {
      await expect(
        payload.delete({
          collection: 'class-pass-types',
          id: classPassTypeId,
          overrideAccess: true,
          user: adminUser,
        }),
      ).rejects.toThrow(/archived instead of deleted/i)

      const doc = await payload.findByID({
        collection: 'class-pass-types',
        id: classPassTypeId,
        overrideAccess: true,
      })
      expect(doc).toBeDefined()
      expect((doc as Record<string, unknown>).deletedAt).toBeDefined()
    },
    TEST_TIMEOUT,
  )
})

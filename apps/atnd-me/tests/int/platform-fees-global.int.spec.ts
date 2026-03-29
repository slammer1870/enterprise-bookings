/**
 * Step 2.7.1 – Platform fees global: admin-only access, effective fee for tenant + product type.
 * - Only admin can read/update the global config.
 * - getEffectiveBookingFeePercent / calculateBookingFeeAmount resolve override > default.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import {
  getEffectiveBookingFeePercent,
  calculateBookingFeeAmount,
} from '@/lib/stripe-connect/bookingFee'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Platform fees global (step 2.7.1)', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let testTenantId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin Platform Fees',
        email: `admin-platform-fees-${Date.now()}@test.com`,
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
        name: 'Platform Fees Tenant',
        slug: `platform-fees-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin Platform Fees',
        email: `tenant-admin-platform-fees-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenantId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Ensure platform-fees global exists with defaults (admin setup)
    await payload.updateGlobal({
      slug: 'platform-fees',
      data: {
        defaults: {
          dropInPercent: 2,
          classPassPercent: 3,
          subscriptionPercent: 4,
        },
        overrides: [],
      },
      depth: 0,
      overrideAccess: true,
    } as Parameters<typeof payload.updateGlobal>[0])
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'users',
          where: {
            id: { in: [adminUser.id, tenantAdminUser.id] as number[] },
          },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: testTenantId } },
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'only admin can read platform-fees global; tenant-admin is denied',
    async () => {
      const asAdmin = await payload.findGlobal({
        slug: 'platform-fees',
        depth: 0,
        overrideAccess: false,
        user: adminUser,
      } as Parameters<typeof payload.findGlobal>[0])
      expect(asAdmin).toBeDefined()
      expect((asAdmin as { defaults?: unknown })?.defaults).toBeDefined()

      await expect(
        payload.findGlobal({
          slug: 'platform-fees',
          depth: 0,
          overrideAccess: false,
          user: tenantAdminUser,
        } as Parameters<typeof payload.findGlobal>[0]),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )

  it(
    'only admin can update platform-fees global; tenant-admin is denied',
    async () => {
      await expect(
        payload.updateGlobal({
          slug: 'platform-fees',
          data: { defaults: { dropInPercent: 99, classPassPercent: 3, subscriptionPercent: 4 } },
          depth: 0,
          overrideAccess: false,
          user: tenantAdminUser,
        } as Parameters<typeof payload.updateGlobal>[0]),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )

  it(
    'resolves effective fee percent: default for product type when no override',
    async () => {
      const dropIn = await getEffectiveBookingFeePercent({
        tenantId: testTenantId,
        productType: 'drop-in',
        payload,
      })
      const classPass = await getEffectiveBookingFeePercent({
        tenantId: testTenantId,
        productType: 'class-pass',
        payload,
      })
      const sub = await getEffectiveBookingFeePercent({
        tenantId: testTenantId,
        productType: 'subscription',
        payload,
      })
      expect(dropIn).toBe(2)
      expect(classPass).toBe(3)
      expect(sub).toBe(4)
    },
    TEST_TIMEOUT,
  )

  it(
    'resolves effective fee percent: tenant override wins over default',
    async () => {
      await payload.updateGlobal({
        slug: 'platform-fees',
        data: {
          defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
          overrides: [
            {
              tenant: testTenantId,
              dropInPercent: 5,
              classPassPercent: 6,
              subscriptionPercent: null,
            },
          ],
        },
        depth: 0,
        overrideAccess: true,
      } as Parameters<typeof payload.updateGlobal>[0])

      const dropIn = await getEffectiveBookingFeePercent({
        tenantId: testTenantId,
        productType: 'drop-in',
        payload,
      })
      const classPass = await getEffectiveBookingFeePercent({
        tenantId: testTenantId,
        productType: 'class-pass',
        payload,
      })
      const sub = await getEffectiveBookingFeePercent({
        tenantId: testTenantId,
        productType: 'subscription',
        payload,
      })
      expect(dropIn).toBe(5)
      expect(classPass).toBe(6)
      expect(sub).toBe(4)
    },
    TEST_TIMEOUT,
  )

  it(
    'calculateBookingFeeAmount uses effective percent and optional bounds',
    async () => {
      await payload.updateGlobal({
        slug: 'platform-fees',
        data: {
          defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
          overrides: [{ tenant: testTenantId, dropInPercent: 10, classPassPercent: null, subscriptionPercent: null }],
          bounds: { minCents: 25, maxCents: 500 },
        },
        depth: 0,
        overrideAccess: true,
      } as Parameters<typeof payload.updateGlobal>[0])

      const feeDropIn = await calculateBookingFeeAmount({
        tenantId: testTenantId,
        productType: 'drop-in',
        classPriceAmount: 1000,
        payload,
      })
      expect(feeDropIn).toBe(100)

      const feeClamped = await calculateBookingFeeAmount({
        tenantId: testTenantId,
        productType: 'drop-in',
        classPriceAmount: 100,
        payload,
      })
      expect(feeClamped).toBe(25)
    },
    TEST_TIMEOUT,
  )
})

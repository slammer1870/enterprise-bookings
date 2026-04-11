import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const testAccountId = (suffix: string) => `acct_${runId}_${suffix}`

type TenantWithStripe = {
  id: number
  slug: string
  name?: string
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
  stripeConnectLastError?: string | null
  stripeConnectConnectedAt?: string | null
}

describe('Tenants collection – Stripe Connect fields (step 2.1)', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let regularUser: User
  let testTenantId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-stripe-fields-${Date.now()}@test.com`,
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
        name: 'Stripe Test Tenant',
        slug: `stripe-fields-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin',
        email: `tenant-admin-stripe-${Date.now()}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenantId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Regular User',
        email: `user-stripe-fields-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
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
          where: {
            id: {
              in: [adminUser.id, tenantAdminUser.id, regularUser.id],
            },
          },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: testTenantId } },
        })
      } catch {
        // ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'tenant doc includes Stripe fields when created/read by admin',
    async () => {
      const accountId = testAccountId('test123')
      const slug = `stripe-created-${Date.now()}`
      const created = await payload.create({
        collection: 'tenants',
        data: {
          name: 'Tenant With Stripe',
          slug,
          stripeConnectAccountId: accountId,
          stripeConnectOnboardingStatus: 'active',
          stripeConnectConnectedAt: new Date().toISOString(),
        },
        user: adminUser,
        overrideAccess: false,
      })

      expect(created).toBeDefined()
      const doc = created as TenantWithStripe
      expect(doc.stripeConnectAccountId).toBe(accountId)
      expect(doc.stripeConnectOnboardingStatus).toBe('active')
      expect(doc.stripeConnectConnectedAt).toBeDefined()

      const found = await payload.findByID({
        collection: 'tenants',
        id: created.id,
        user: adminUser,
        overrideAccess: false,
      }) as TenantWithStripe
      expect(found.stripeConnectAccountId).toBe(accountId)
      expect(found.stripeConnectOnboardingStatus).toBe('active')
    },
    TEST_TIMEOUT,
  )

  it(
    'only admin can update Stripe fields directly; tenant-admin cannot',
    async () => {
      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: { stripeConnectAccountId: testAccountId('original') },
        user: adminUser,
        overrideAccess: false,
      })

      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: { stripeConnectAccountId: testAccountId('tampered') },
        user: tenantAdminUser,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        user: adminUser,
        overrideAccess: false,
      }) as TenantWithStripe
      expect(after.stripeConnectAccountId).toBe(testAccountId('original'))
    },
    TEST_TIMEOUT,
  )

  it(
    'tenant-admin can read their tenant including connection status fields',
    async () => {
      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: {
          stripeConnectAccountId: testAccountId('tenantadmin'),
          stripeConnectOnboardingStatus: 'active',
        },
        user: adminUser,
        overrideAccess: true,
      })

      const found = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        user: tenantAdminUser,
        overrideAccess: false,
      }) as TenantWithStripe

      expect(found).toBeDefined()
      expect(found.stripeConnectOnboardingStatus).toBe('active')
      expect(found.stripeConnectAccountId).toBe(testAccountId('tenantadmin'))
    },
    TEST_TIMEOUT,
  )

  it(
    'only admin can update allowedBlocks; tenant-admin cannot',
    async () => {
      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: { allowedBlocks: ['location'] },
        user: adminUser,
        overrideAccess: false,
      })

      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: { allowedBlocks: ['faqs', 'archive'] },
        user: tenantAdminUser,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        user: adminUser,
        overrideAccess: false,
      })
      expect(after.allowedBlocks).toEqual(['location'])
    },
    TEST_TIMEOUT,
  )

  it(
    'only admin can update slug; tenant-admin cannot',
    async () => {
      const before = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        user: adminUser,
        overrideAccess: false,
      })
      const originalSlug = before.slug

      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: { slug: 'tenant-admin-tampered-slug' },
        user: tenantAdminUser,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        user: adminUser,
        overrideAccess: false,
      })
      expect(after.slug).toBe(originalSlug)
    },
    TEST_TIMEOUT,
  )

  it(
    'regular users (and public read) do not see Stripe fields',
    async () => {
      const foundAsRegular = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        user: regularUser,
        overrideAccess: false,
      }) as TenantWithStripe

      expect(foundAsRegular).toBeDefined()
      expect(foundAsRegular.slug).toBeDefined()
      expect(foundAsRegular.stripeConnectAccountId).toBeUndefined()
      expect(foundAsRegular.stripeConnectLastError).toBeUndefined()

      const foundPublic = await payload.find({
        collection: 'tenants',
        where: { id: { equals: testTenantId } },
        limit: 1,
        overrideAccess: false,
      })
      const doc = foundPublic.docs[0] as TenantWithStripe | undefined
      expect(doc).toBeDefined()
      expect(doc?.slug).toBeDefined()
      expect(doc?.stripeConnectAccountId).toBeUndefined()
      expect(doc?.stripeConnectLastError).toBeUndefined()
    },
    TEST_TIMEOUT,
  )
})

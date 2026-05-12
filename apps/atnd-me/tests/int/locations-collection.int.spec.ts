import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Tenant } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Locations collection (Phase 7 — branches per tenant)', () => {
  let payload: Payload
  let superAdmin: User
  let tenantA: Tenant
  let tenantB: Tenant
  let orgAdminTenantA: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const ts = Date.now()

    tenantA = (await payload.create({
      collection: 'tenants',
      data: { name: 'Tenant A Locations', slug: `loc-test-a-${ts}` },
      overrideAccess: true,
    })) as Tenant

    tenantB = (await payload.create({
      collection: 'tenants',
      data: { name: 'Tenant B Locations', slug: `loc-test-b-${ts}` },
      overrideAccess: true,
    })) as Tenant

    superAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Super Admin',
        email: `super-loc-${ts}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    orgAdminTenantA = (await payload.create({
      collection: 'users',
      data: {
        name: 'Org Admin A',
        email: `org-admin-loc-${ts}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenantA.id }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload) return
    try {
      await payload.delete({
        collection: 'locations',
        where: {
          or: [{ tenant: { equals: tenantA.id } }, { tenant: { equals: tenantB.id } }],
        },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'users',
        where: { id: { in: [superAdmin.id, orgAdminTenantA.id] } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [tenantA.id, tenantB.id] } },
        overrideAccess: true,
      })
    } catch {
      // ignore cleanup errors
    }
    await payload.db?.destroy?.()
  })

  it(
    'allows org admin to create two branches for their tenant',
    async () => {
      const branch1 = await payload.create({
        collection: 'locations',
        data: {
          tenant: tenantA.id,
          name: 'North Studio',
          slug: `north-${Date.now()}`,
        },
        user: orgAdminTenantA,
        overrideAccess: false,
      })
      const branch2 = await payload.create({
        collection: 'locations',
        data: {
          tenant: tenantA.id,
          name: 'South Studio',
          slug: `south-${Date.now()}`,
        },
        user: orgAdminTenantA,
        overrideAccess: false,
      })

      expect(branch1.slug).toBeTruthy()
      expect(branch2.slug).toBeTruthy()
      const t1 = typeof branch1.tenant === 'object' ? branch1.tenant?.id : branch1.tenant
      const t2 = typeof branch2.tenant === 'object' ? branch2.tenant?.id : branch2.tenant
      expect(t1).toBe(tenantA.id)
      expect(t2).toBe(tenantA.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows the same slug on a different tenant',
    async () => {
      const sharedSlug = `shared-town-${Date.now()}`

      const onA = await payload.create({
        collection: 'locations',
        data: {
          tenant: tenantA.id,
          name: 'Town A branch',
          slug: sharedSlug,
        },
        user: superAdmin,
        overrideAccess: false,
      })

      const onB = await payload.create({
        collection: 'locations',
        data: {
          tenant: tenantB.id,
          name: 'Town B branch',
          slug: sharedSlug,
        },
        user: superAdmin,
        overrideAccess: false,
      })

      expect(onA.slug).toBe(sharedSlug)
      expect(onB.slug).toBe(sharedSlug)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects duplicate slug for the same tenant',
    async () => {
      const slug = `dup-branch-${Date.now()}`

      await payload.create({
        collection: 'locations',
        data: {
          tenant: tenantA.id,
          name: 'First',
          slug,
        },
        user: superAdmin,
        overrideAccess: false,
      })

      await expect(
        payload.create({
          collection: 'locations',
          data: {
            tenant: tenantA.id,
            name: 'Second',
            slug,
          },
          user: superAdmin,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/already exists for this tenant/i)
    },
    TEST_TIMEOUT,
  )

  it(
    'denies org admin creating a location for a tenant they do not manage',
    async () => {
      await expect(
        payload.create({
          collection: 'locations',
          data: {
            tenant: tenantB.id,
            name: 'Should not exist',
            slug: `forbidden-${Date.now()}`,
          },
          user: orgAdminTenantA,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )

  it(
    'allows super-admin to read, update, and delete a location on another tenant',
    async () => {
      const slug = `super-crud-${Date.now()}`
      const created = await payload.create({
        collection: 'locations',
        data: {
          tenant: tenantB.id,
          name: 'CRUD Target',
          slug,
        },
        user: superAdmin,
        overrideAccess: false,
      })

      const found = await payload.findByID({
        collection: 'locations',
        id: created.id,
        user: superAdmin,
        overrideAccess: false,
      })
      expect(found.name).toBe('CRUD Target')

      const updated = await payload.update({
        collection: 'locations',
        id: created.id,
        data: { name: 'CRUD Updated' },
        user: superAdmin,
        overrideAccess: false,
      })
      expect(updated.name).toBe('CRUD Updated')

      await payload.delete({
        collection: 'locations',
        id: created.id,
        user: superAdmin,
        overrideAccess: false,
      })

      await expect(
        payload.findByID({
          collection: 'locations',
          id: created.id,
          user: superAdmin,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )
})

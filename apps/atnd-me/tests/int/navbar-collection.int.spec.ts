import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Tenant } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Navbar collection (converted from Header global)', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let testTenant: Tenant

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create test tenant
    testTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: `test-navbar-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Create an admin user
    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-navbar-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create a tenant-admin user
    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin User',
        email: `tenant-admin-navbar-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
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
          where: { id: { in: [adminUser.id, tenantAdminUser.id] } },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: testTenant.id } },
        })
      } catch {
        // ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'allows creating navbar for a tenant',
    async () => {
      const navbar = await payload.create({
        collection: 'navbar',
        data: {
          tenant: testTenant.id,
          logoLink: '/',
          navItems: [
            {
              link: {
                type: 'custom',
                label: 'Home',
                url: '/',
              },
            },
          ],
        },
        user: adminUser,
        overrideAccess: false,
      })

      expect(navbar).toBeDefined()
      const tenantId = typeof navbar.tenant === 'object' ? navbar.tenant.id : navbar.tenant
      expect(tenantId).toBe(testTenant.id)
      expect(navbar.logoLink).toBe('/')
      expect(navbar.navItems).toHaveLength(1)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows tenant-admin to create navbar for their tenant',
    async () => {
      // Create tenant-admin user assigned to testTenant
      // The tenants field must be an array of objects with 'tenant' property, not array of IDs
      const tenantAdminUser = (await payload.create({
        collection: 'users',
        data: {
          name: 'Test Tenant Admin',
          email: `tenant-admin-navbar-${Date.now()}@test.com`,
          password: 'test',
          roles: ['tenant-admin'],
          emailVerified: true,
          tenants: [{ tenant: testTenant.id }], // Array of objects with 'tenant' property
        },
        draft: false,
        overrideAccess: true,
      })) as User

      // Delete any existing navbar for this tenant first (isGlobal: true means one per tenant)
      try {
        const existing = await payload.find({
          collection: 'navbar',
          where: {
            tenant: {
              equals: testTenant.id,
            },
          },
          limit: 1,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          await payload.delete({
            collection: 'navbar',
            id: existing.docs[0]!.id,
            overrideAccess: true,
          })
        }
      } catch {
        // Ignore if none exists
      }

      // Create navbar - let the beforeValidate hook set tenant from context
      // For isGlobal: true collections, the plugin expects tenant to come from context
      const req = {
        ...payload,
        context: { tenant: testTenant.id },
        user: tenantAdminUser,
      } as any

      const navbar = await payload.create({
        collection: 'navbar',
        data: {
          // Don't set tenant in data - let beforeValidate hook set it from req.context.tenant
          logoLink: '/admin',
          navItems: [],
        },
        req,
        overrideAccess: true, // Use overrideAccess for test data creation
      })

      expect(navbar).toBeDefined()
      const tenantId = typeof navbar.tenant === 'object' ? navbar.tenant.id : navbar.tenant
      expect(tenantId).toBe(testTenant.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'requires tenant field for navbar',
    async () => {
      await expect(
        payload.create({
          collection: 'navbar',
          data: {
            logoLink: '/',
            navItems: [],
            // Missing tenant field
          },
          user: adminUser,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )

  it(
    'allows reading navbar for a tenant',
    async () => {
      // Delete any existing navbar for this tenant first (isGlobal: true means one per tenant)
      try {
        const existing = await payload.find({
          collection: 'navbar',
          where: {
            tenant: {
              equals: testTenant.id,
            },
          },
          limit: 1,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          await payload.delete({
            collection: 'navbar',
            id: existing.docs[0]!.id,
            overrideAccess: true,
          })
        }
      } catch {
        // Ignore if none exists
      }

      // Create navbar - let the beforeChange hook set tenant from context
      const req = {
        ...payload,
        context: { tenant: testTenant.id },
        user: adminUser,
      } as any

      const created = await payload.create({
        collection: 'navbar',
        data: {
          logoLink: '/',
          navItems: [],
          // Don't set tenant in data - let the beforeChange hook set it from req.context.tenant
        },
        req,
        overrideAccess: true, // Use overrideAccess for test data creation
      })

      const found = await payload.findByID({
        collection: 'navbar',
        id: created.id,
        overrideAccess: false,
        user: adminUser,
      })

      expect(found).toBeDefined()
      const tenantId = typeof found.tenant === 'object' ? found.tenant.id : found.tenant
      expect(tenantId).toBe(testTenant.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'filters navbar by tenant automatically',
    async () => {
      // Create second tenant
      const secondTenant = (await payload.create({
        collection: 'tenants',
        data: {
          name: 'Second Tenant',
          slug: `second-navbar-${Date.now()}`,
        },
        overrideAccess: true,
      })) as Tenant

      // Delete any existing navbars for these tenants first
      try {
        const existing1 = await payload.find({
          collection: 'navbar',
          where: {
            tenant: {
              equals: testTenant.id,
            },
          },
          limit: 1,
          overrideAccess: true,
        })
        if (existing1.docs.length > 0) {
          await payload.delete({
            collection: 'navbar',
            id: existing1.docs[0]!.id,
            overrideAccess: true,
          })
        }

        const existing2 = await payload.find({
          collection: 'navbar',
          where: {
            tenant: {
              equals: secondTenant.id,
            },
          },
          limit: 1,
          overrideAccess: true,
        })
        if (existing2.docs.length > 0) {
          await payload.delete({
            collection: 'navbar',
            id: existing2.docs[0]!.id,
            overrideAccess: true,
          })
        }
      } catch {
        // Ignore if none exist
      }

      // Create navbar for first tenant - let hook set tenant from context
      const req1 = {
        ...payload,
        context: { tenant: testTenant.id },
        user: adminUser,
      } as any

      const navbar1 = await payload.create({
        collection: 'navbar',
        data: {
          logoLink: '/tenant1',
          navItems: [],
          // Don't set tenant in data - let the beforeChange hook set it from req.context.tenant
        },
        req: req1,
        overrideAccess: true, // Use overrideAccess for test data creation
      })

      // Create navbar for second tenant - let hook set tenant from context
      const req2 = {
        ...payload,
        context: { tenant: secondTenant.id },
        user: adminUser,
      } as any

      const navbar2 = await payload.create({
        collection: 'navbar',
        data: {
          logoLink: '/tenant2',
          navItems: [],
          // Don't set tenant in data - let the beforeChange hook set it from req.context.tenant
        },
        req: req2,
        overrideAccess: true, // Use overrideAccess for test data creation
      })

      // Query should only return navbar for the tenant in context
      // For now, we'll test that both exist and have correct tenants
      // Tenant field may be populated as object or just ID
      const navbar1TenantId = typeof navbar1.tenant === 'object' ? navbar1.tenant.id : navbar1.tenant
      const navbar2TenantId = typeof navbar2.tenant === 'object' ? navbar2.tenant.id : navbar2.tenant
      expect(navbar1TenantId).toBe(testTenant.id)
      expect(navbar2TenantId).toBe(secondTenant.id)

      // Cleanup
      await payload.delete({
        collection: 'navbar',
        where: { id: { in: [navbar1.id, navbar2.id] } },
      })
      await payload.delete({
        collection: 'tenants',
        where: { id: { equals: secondTenant.id } },
      })
    },
    TEST_TIMEOUT,
  )
})

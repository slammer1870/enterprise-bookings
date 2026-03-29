import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000 // 5 minutes (matches other int tests)
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Tenants collection', () => {
  let payload: Payload
  let adminUser: User
  let regularUser: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create an admin user for access control tests
    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-tenants-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create a regular user for negative access tests
    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Regular User',
        email: `user-tenants-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
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
          where: { id: { in: [adminUser.id, regularUser.id] } },
        })
      } catch {
        // ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'allows creating and reading a tenant as admin',
    async () => {
      const slug = `test-tenant-${Date.now()}`

      const created = await payload.create({
        collection: 'tenants',
        data: {
          name: 'Test Tenant',
          slug,
        },
        user: adminUser,
        overrideAccess: false,
      })

      expect(created).toBeDefined()
      expect(created.slug).toBe(slug)
      expect(created.name).toBe('Test Tenant')

      const found = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        overrideAccess: false,
        user: adminUser,
      })

      expect(found.docs.length).toBe(1)
      expect(found.docs[0]?.slug).toBe(slug)
    },
    TEST_TIMEOUT,
  )

  it(
    'exposes tenants for public read (listing page)',
    async () => {
      const slug = `public-tenant-${Date.now()}`

      // Create via admin
      await payload.create({
        collection: 'tenants',
        data: {
          name: 'Public Tenant',
          slug,
        },
        user: adminUser,
        overrideAccess: false,
      })

      // Public read (no user)
      const found = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        // no user, rely on collection read access
      })

      expect(found.docs.length).toBe(1)
      expect(found.docs[0]?.slug).toBe(slug)
    },
    TEST_TIMEOUT,
  )

  it(
    'prevents regular users from creating tenants',
    async () => {
      const slug = `forbidden-tenant-${Date.now()}`

      await expect(
        payload.create({
          collection: 'tenants',
          data: {
            name: 'Forbidden Tenant',
            slug,
          },
          user: regularUser,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )
})


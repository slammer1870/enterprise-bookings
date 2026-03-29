import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Roles configuration', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let regularUser: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create an admin user
    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-roles-${Date.now()}@test.com`,
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
        email: `tenant-admin-roles-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create a regular user
    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Regular User',
        email: `user-roles-${Date.now()}@test.com`,
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
          where: { id: { in: [adminUser.id, tenantAdminUser.id, regularUser.id] } },
        })
      } catch {
        // ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'allows creating users with admin role',
    async () => {
      expect(adminUser).toBeDefined()
      expect(adminUser.roles).toContain('admin')
      expect(checkRole(['admin'], adminUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows creating users with tenant-admin role',
    async () => {
      expect(tenantAdminUser).toBeDefined()
      expect(tenantAdminUser.roles).toContain('tenant-admin')
      expect(checkRole(['tenant-admin'], tenantAdminUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows creating users with user role',
    async () => {
      expect(regularUser).toBeDefined()
      expect(regularUser.roles).toContain('user')
      expect(checkRole(['user'], regularUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'validates role checks correctly',
    async () => {
      // Admin should pass admin check
      expect(checkRole(['admin'], adminUser)).toBe(true)
      // Admin should NOT pass tenant-admin check
      expect(checkRole(['tenant-admin'], adminUser)).toBe(false)
      // Admin should NOT pass user check
      expect(checkRole(['user'], adminUser)).toBe(false)

      // Tenant-admin should pass tenant-admin check
      expect(checkRole(['tenant-admin'], tenantAdminUser)).toBe(true)
      // Tenant-admin should NOT pass admin check
      expect(checkRole(['admin'], tenantAdminUser)).toBe(false)
      // Tenant-admin should NOT pass user check
      expect(checkRole(['user'], tenantAdminUser)).toBe(false)

      // User should pass user check
      expect(checkRole(['user'], regularUser)).toBe(true)
      // User should NOT pass admin check
      expect(checkRole(['admin'], regularUser)).toBe(false)
      // User should NOT pass tenant-admin check
      expect(checkRole(['tenant-admin'], regularUser)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows updating user roles',
    async () => {
      // Update regular user to tenant-admin
      const updated = await payload.update({
        collection: 'users',
        id: regularUser.id,
        data: {
          roles: ['tenant-admin'],
        },
        overrideAccess: true,
      })

      expect(updated.roles).toContain('tenant-admin')
      expect(checkRole(['tenant-admin'], updated as User)).toBe(true)

      // Restore to user role
      await payload.update({
        collection: 'users',
        id: regularUser.id,
        data: {
          roles: ['user'],
        },
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})

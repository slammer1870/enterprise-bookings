import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

/**
 * Tests that the admin dashboard access rule is enforced: only users with
 * 'admin' or 'tenant-admin' role can access the admin panel; regular users
 * (and unauthenticated) cannot.
 *
 * Note: Auth routes (login, create-first-user, logout, etc.) are accessible
 * without authentication and are handled separately in the layout.
 *
 * This mirrors the core access logic in src/app/(payload)/admin/layout.tsx:
 *   if (!user || !checkRole(['admin', 'tenant-admin'], user)) redirect('/')
 */
const canAccessAdmin = (user: User | null): boolean =>
  !!user && checkRole(['admin', 'tenant-admin'], user)

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Admin dashboard access control', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let regularUser: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-dash-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin User',
        email: `tenant-admin-dash-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Regular User',
        email: `user-dash-${Date.now()}@test.com`,
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
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'allows admin to access the admin dashboard',
    () => {
      expect(canAccessAdmin(adminUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows tenant-admin to access the admin dashboard',
    () => {
      expect(canAccessAdmin(tenantAdminUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'prevents regular user from accessing the admin dashboard',
    () => {
      expect(canAccessAdmin(regularUser)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'prevents unauthenticated (null user) from accessing the admin dashboard',
    () => {
      expect(canAccessAdmin(null)).toBe(false)
    },
    TEST_TIMEOUT,
  )
})

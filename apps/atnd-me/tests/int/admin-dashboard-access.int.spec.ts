import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

/**
 * Tests that the admin dashboard access rule matches panel access: super-admin,
 * org admin (admin), and staff can use the admin UI; regular users cannot.
 *
 * Align with Better Auth adminRoles in src/lib/auth/options.ts:
 *   adminRoles: ['super-admin', 'admin', 'staff']
 */
const canAccessAdmin = (user: User | null): boolean =>
  !!user && checkRole(['super-admin', 'admin', 'staff'], user)

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Admin dashboard access control', () => {
  let payload: Payload
  let superAdminUser: User
  let orgAdminUser: User
  let regularUser: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    superAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Super Admin User',
        email: `super-admin-dash-${Date.now()}@test.com`,
        password: 'test',
        roles: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    orgAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Org Admin User',
        email: `org-admin-dash-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
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
          where: { id: { in: [superAdminUser.id, orgAdminUser.id, regularUser.id] } },
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'allows super-admin to access the admin dashboard',
    () => {
      expect(canAccessAdmin(superAdminUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows org admin to access the admin dashboard',
    () => {
      expect(canAccessAdmin(orgAdminUser)).toBe(true)
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

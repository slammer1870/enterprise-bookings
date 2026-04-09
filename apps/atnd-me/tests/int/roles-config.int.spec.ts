import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

const HOOK_TIMEOUT = 300000 // 5 minutes
const TEST_TIMEOUT = 60000 // 60 seconds

describe('Roles configuration', () => {
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
        email: `super-admin-roles-${Date.now()}@test.com`,
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
        email: `org-admin-roles-${Date.now()}@test.com`,
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
          where: { id: { in: [superAdminUser.id, orgAdminUser.id, regularUser.id] } },
        })
      } catch {
        // ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'allows creating users with super-admin role',
    async () => {
      expect(superAdminUser).toBeDefined()
      expect(superAdminUser.roles).toContain('super-admin')
      expect(checkRole(['super-admin'], superAdminUser)).toBe(true)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows creating users with org admin role',
    async () => {
      expect(orgAdminUser).toBeDefined()
      expect(orgAdminUser.roles).toContain('admin')
      expect(checkRole(['admin'], orgAdminUser)).toBe(true)
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
      expect(checkRole(['super-admin'], superAdminUser)).toBe(true)
      expect(checkRole(['admin'], superAdminUser)).toBe(false)
      expect(checkRole(['user'], superAdminUser)).toBe(false)

      expect(checkRole(['admin'], orgAdminUser)).toBe(true)
      expect(checkRole(['super-admin'], orgAdminUser)).toBe(false)
      expect(checkRole(['user'], orgAdminUser)).toBe(false)

      expect(checkRole(['user'], regularUser)).toBe(true)
      expect(checkRole(['super-admin'], regularUser)).toBe(false)
      expect(checkRole(['admin'], regularUser)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows updating user roles',
    async () => {
      const updated = await payload.update({
        collection: 'users',
        id: regularUser.id,
        data: {
          roles: ['admin'],
        },
        overrideAccess: true,
      })

      expect(updated.roles).toContain('admin')
      expect(checkRole(['admin'], updated as User)).toBe(true)

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

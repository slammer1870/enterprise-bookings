import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Tenant, Lesson, ClassOption } from '@repo/shared-types'

const TEST_TIMEOUT = 60000 // 60 seconds
const HOOK_TIMEOUT = 300000 // 5 minutes

describe('User Tenant Access Control', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let regularUser: User
  let testTenant: Tenant
  let secondTenant: Tenant

  // Helper to create tenant-scoped documents with tenant context
  const createWithTenantContext = async <T = any>(
    collection: string,
    data: any,
    tenantId: number | string,
    options?: Omit<Parameters<typeof payload.create>[0], 'collection' | 'data' | 'req'>
  ): Promise<T> => {
    const req = {
      ...payload,
      context: { tenant: tenantId },
    } as any
    
    // Fix lesson dates if they're the same (endTime must be after startTime)
    if (collection === 'timeslots' && data.startTime && data.endTime) {
      const startTime = new Date(data.startTime)
      const endTime = new Date(data.endTime)
      // If endTime is same or before startTime, set it to 1 hour later
      if (endTime <= startTime) {
        endTime.setHours(startTime.getHours() + 1)
        data.endTime = endTime.toISOString()
      }
    }
    
    // Explicitly set tenant in data for collections that don't have beforeValidate hooks
    // Collections with isGlobal: true (navbar, footer, scheduler) have hooks that set it from context
    // But standard collections (lessons, class-options, etc.) need it in data
    const dataWithTenant = {
      ...data,
      tenant: tenantId,
    }
    return payload.create({
      collection,
      data: dataWithTenant,
      req,
      ...options,
    } as Parameters<typeof payload.create>[0]) as Promise<T>
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create test tenants
    testTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-access-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    secondTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Second Tenant',
        slug: `second-tenant-access-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Create admin user (can access all tenants)
    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-access-${Date.now()}@test.com`,
        password: 'test',
        roles: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create tenant-admin user (can only access testTenant)
    // The tenants field must be an array of objects with 'tenant' property, not array of IDs
    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin User',
        email: `tenant-admin-access-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenant.id }], // Array of objects with 'tenant' property
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create regular user (can book cross-tenant but can't manage config)
    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Regular User',
        email: `user-access-${Date.now()}@test.com`,
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
      await payload.db?.destroy?.()
    }
  })

  describe('Auth collections (accounts, sessions, verifications, admin-invitations) restricted to full admin', () => {
    const AUTH_COLLECTION_SLUGS = ['accounts', 'sessions', 'verifications', 'admin-invitations'] as const

    it(
      'tenant-admin cannot read accounts, sessions, verifications, or admin-invitations',
      async () => {
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: tenantAdminUser,
        } as any

        for (const slug of AUTH_COLLECTION_SLUGS) {
          const collection = payload.config.collections?.find((c) => c.slug === slug)
          if (!collection) continue // skip if plugin did not register this collection

          await expect(
            payload.find({
              collection: slug,
              where: {},
              limit: 1,
              req,
              overrideAccess: false,
            }),
          ).rejects.toThrow()
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin cannot create admin invitations',
      async () => {
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: tenantAdminUser,
        } as any

        await expect(
          payload.create({
            collection: 'admin-invitations',
            data: { role: 'user' },
            req,
            overrideAccess: false,
          }),
        ).rejects.toThrow()
      },
      TEST_TIMEOUT,
    )

    it(
      'super admin can read auth collections',
      async () => {
        const req = {
          ...payload,
          user: adminUser,
        } as any

        for (const slug of AUTH_COLLECTION_SLUGS) {
          const collection = payload.config.collections?.find((c) => c.slug === slug)
          if (!collection) continue

          const result = await payload.find({
            collection: slug,
            where: {},
            limit: 1,
            req,
            overrideAccess: false,
          })
          expect(result).toBeDefined()
          expect(Array.isArray(result.docs)).toBe(true)
        }
      },
      TEST_TIMEOUT,
    )
  })

  describe('Admin user access', () => {
    it(
      'can read all tenant-scoped documents across all tenants',
      async () => {
        // Create test data for both tenants using tenant context
        const testTenantClassOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Test Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const testTenantLesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            classOption: testTenantClassOption.id,
            active: true,
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const secondTenantClassOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Second Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        const secondTenantLesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            classOption: secondTenantClassOption.id,
            active: true,
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        // Admin should be able to read both lessons
        const adminLessons = await payload.find({
          collection: 'timeslots',
          where: {},
          limit: 100,
          user: adminUser,
          overrideAccess: false, // Enforce access control
        })

        const lessonIds = adminLessons.docs.map((l) => l.id)
        expect(lessonIds).toContain(testTenantLesson.id)
        expect(lessonIds).toContain(secondTenantLesson.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'can create documents for any tenant',
      async () => {
        // Create class option for testTenant (same tenant as the lesson we'll create)
        const classOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Admin Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        // Admin should be able to create for any tenant
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: adminUser,
        } as any

        // Create lesson with proper start/end times
        const lessonDate = new Date()
        lessonDate.setHours(10, 0, 0, 0)
        const lessonEndTime = new Date(lessonDate)
        lessonEndTime.setHours(11, 0, 0, 0)

        const newLesson = await payload.create({
          collection: 'timeslots',
          data: {
            tenant: testTenant.id, // Explicitly set tenant
            date: lessonDate.toISOString(),
            startTime: lessonDate.toISOString(),
            endTime: lessonEndTime.toISOString(),
            classOption: classOption.id,
            active: true,
          },
          req,
          overrideAccess: false, // Enforce access control
        })

        expect(newLesson).toBeDefined()
        expect(newLesson.id).toBeDefined()
      },
      TEST_TIMEOUT,
    )
  })

  describe('Tenant-admin user access', () => {
    it(
      'can only read documents from their assigned tenant',
      async () => {
        // Create test data for both tenants using tenant context
        const testTenantClassOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Tenant Admin Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const testTenantLesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            classOption: testTenantClassOption.id,
            active: true,
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const secondTenantClassOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Other Tenant Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        const secondTenantLesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            classOption: secondTenantClassOption.id,
            active: true,
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        // Tenant-admin should only see their tenant's lessons
        // Set tenant context in req so access control can filter correctly
        const tenantAdminReq = {
          ...payload,
          context: { tenant: testTenant.id },
          user: tenantAdminUser,
        } as any

        const tenantAdminLessons = await payload.find({
          collection: 'timeslots',
          where: {},
          limit: 100,
          req: tenantAdminReq,
          overrideAccess: false, // Enforce access control
        })

        const lessonIds = tenantAdminLessons.docs.map((l) => l.id)
        expect(lessonIds).toContain(testTenantLesson.id)
        expect(lessonIds).not.toContain(secondTenantLesson.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'can create documents for their assigned tenant',
      async () => {
        // Create class option first with tenant context
        const classOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Tenant Admin Create Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        // Create lesson with tenant-admin user (should succeed for their tenant)
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: tenantAdminUser,
        } as any

        // Create lesson with proper start/end times
        const lessonDate = new Date()
        lessonDate.setHours(10, 0, 0, 0)
        const lessonEndTime = new Date(lessonDate)
        lessonEndTime.setHours(11, 0, 0, 0)

        const newLesson = await payload.create({
          collection: 'timeslots',
          data: {
            tenant: testTenant.id, // Explicitly set tenant (tenant-admin can only create for their tenant)
            date: lessonDate.toISOString(),
            startTime: lessonDate.toISOString(),
            endTime: lessonEndTime.toISOString(),
            classOption: classOption.id,
            active: true,
          },
          req,
          overrideAccess: false, // Enforce access control
        })

        expect(newLesson).toBeDefined()
        expect(newLesson.id).toBeDefined()
      },
      TEST_TIMEOUT,
    )

    it(
      'cannot create documents for other tenants',
      async () => {
        // Create class option for second tenant (tenant-admin shouldn't be able to create lesson for it)
        const classOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Unauthorized Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        // Try to create lesson for second tenant as tenant-admin (should fail)
        const req = {
          ...payload,
          context: { tenant: secondTenant.id },
          user: tenantAdminUser,
        } as any

        await expect(
          payload.create({
            collection: 'timeslots',
            data: {
              date: new Date().toISOString(),
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              classOption: classOption.id,
              active: true,
            },
            req,
            overrideAccess: false, // Enforce access control
          }),
        ).rejects.toThrow()
      },
      TEST_TIMEOUT,
    )
  })

  describe('Users collection read/update scoping (userTenantAccess)', () => {
    let userInTestTenant: User
    let userInSecondTenant: User

    beforeAll(async () => {
      // User who registered in testTenant
      userInTestTenant = (await payload.create({
        collection: 'users',
        data: {
          name: 'User In Test Tenant',
          email: `user-test-tenant-${Date.now()}@test.com`,
          password: 'test',
          roles: ['user'],
          emailVerified: true,
          registrationTenant: testTenant.id,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      // User who registered in secondTenant
      userInSecondTenant = (await payload.create({
        collection: 'users',
        data: {
          name: 'User In Second Tenant',
          email: `user-second-tenant-${Date.now()}@test.com`,
          password: 'test',
          roles: ['user'],
          emailVerified: true,
          registrationTenant: secondTenant.id,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User
    })

    it(
      'super admin can read all users',
      async () => {
        const adminUsers = await payload.find({
          collection: 'users',
          where: {},
          limit: 100,
          user: adminUser,
          overrideAccess: false,
        })
        const userIds = adminUsers.docs.map((u) => u.id)
        expect(userIds).toContain(adminUser.id)
        expect(userIds).toContain(tenantAdminUser.id)
        expect(userIds).toContain(regularUser.id)
        expect(userIds).toContain(userInTestTenant.id)
        expect(userIds).toContain(userInSecondTenant.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin can only read users in their assigned tenant',
      async () => {
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: tenantAdminUser,
        } as any

        const tenantAdminUsers = await payload.find({
          collection: 'users',
          where: {},
          limit: 100,
          req,
          overrideAccess: false,
        })
        const userIds = tenantAdminUsers.docs.map((u) => u.id)
        expect(userIds).toContain(tenantAdminUser.id)
        expect(userIds).toContain(userInTestTenant.id)
        expect(userIds).not.toContain(userInSecondTenant.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin cannot update users in other tenants',
      async () => {
        const req = {
          ...payload,
          context: { tenant: secondTenant.id },
          user: tenantAdminUser,
        } as any

        await expect(
          payload.update({
            collection: 'users',
            id: userInSecondTenant.id,
            data: { name: 'Attempted Update' },
            req,
            overrideAccess: false,
          }),
        ).rejects.toThrow()
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin can update users in their tenant',
      async () => {
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: tenantAdminUser,
        } as any

        const updated = await payload.update({
          collection: 'users',
          id: userInTestTenant.id,
          data: { name: 'Updated By Tenant Admin' },
          req,
          overrideAccess: false,
        })
        expect(updated.name).toBe('Updated By Tenant Admin')

        await payload.update({
          collection: 'users',
          id: userInTestTenant.id,
          data: { name: 'User In Test Tenant' },
          overrideAccess: true,
        })
      },
      TEST_TIMEOUT,
    )

    it(
      'regular user can read themselves',
      async () => {
        const self = await payload.findByID({
          collection: 'users',
          id: regularUser.id,
          user: regularUser,
          overrideAccess: false,
        })
        expect(self).toBeDefined()
        expect(self.id).toBe(regularUser.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'regular user can update themselves',
      async () => {
        const updated = await payload.update({
          collection: 'users',
          id: regularUser.id,
          data: { name: 'Self Updated Name' },
          user: regularUser,
          overrideAccess: false,
        })
        expect(updated.name).toBe('Self Updated Name')

        await payload.update({
          collection: 'users',
          id: regularUser.id,
          data: { name: 'Regular User' },
          overrideAccess: true,
        })
      },
      TEST_TIMEOUT,
    )

    it(
      'regular user cannot read other users via find',
      async () => {
        const users = await payload.find({
          collection: 'users',
          where: {},
          limit: 100,
          user: regularUser,
          overrideAccess: false,
        })
        const userIds = users.docs.map((u) => u.id)
        expect(userIds).toContain(regularUser.id)
        expect(userIds).not.toContain(adminUser.id)
        expect(userIds).not.toContain(tenantAdminUser.id)
        expect(userIds).not.toContain(userInTestTenant.id)
        expect(userIds).not.toContain(userInSecondTenant.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin can read users when req.user is a shallow session user (no tenants populated)',
      async () => {
        // Simulate Better Auth / session: user object without populated `tenants` relationship.
        // Access control should fetch the full user from DB and still resolve tenant IDs.
        const shallowSessionUser = {
          id: tenantAdminUser.id,
          email: tenantAdminUser.email,
          name: tenantAdminUser.name,
          roles: ['admin'],
          role: 'admin',
          // Intentionally omit: tenants
        }
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: shallowSessionUser,
        } as any

        const tenantAdminUsers = await payload.find({
          collection: 'users',
          where: {},
          limit: 100,
          req,
          overrideAccess: false,
        })
        const userIds = tenantAdminUsers.docs.map((u) => u.id)
        expect(userIds).toContain(tenantAdminUser.id)
        expect(userIds).toContain(userInTestTenant.id)
        expect(userIds).not.toContain(userInSecondTenant.id)
      },
      TEST_TIMEOUT,
    )

    describe('Tenant-admin sees users who have a booking with their tenant', () => {
      let userWithBookingOnly: User
      let bookingLesson: Lesson

      beforeAll(async () => {
        // User who registered in secondTenant (so not visible by registrationTenant for testTenant)
        userWithBookingOnly = (await payload.create({
          collection: 'users',
          data: {
            name: 'User With Booking Only',
            email: `user-booking-only-${Date.now()}@test.com`,
            password: 'test',
            roles: ['user'],
            emailVerified: true,
            registrationTenant: secondTenant.id,
          },
          draft: false,
          overrideAccess: true,
        } as Parameters<typeof payload.create>[0])) as User

        const classOpt = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Booking visibility class ${Date.now()}`,
            places: 10,
            description: 'For tenant-admin user list test',
          },
          testTenant.id,
          { overrideAccess: true },
        ))
        bookingLesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 3600000).toISOString(),
            classOption: classOpt.id,
            active: true,
          },
          testTenant.id,
          { overrideAccess: true },
        ))

        await payload.create({
          collection: 'bookings',
          data: {
            user: userWithBookingOnly.id,
            lesson: bookingLesson.id,
            tenant: testTenant.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })
      })

      it(
        'tenant-admin sees users who have made a booking with their tenant',
        async () => {
          const req = {
            ...payload,
            context: { tenant: testTenant.id },
            user: tenantAdminUser,
          } as any

          const tenantAdminUsers = await payload.find({
            collection: 'users',
            where: {},
            limit: 100,
            req,
            overrideAccess: false,
          })
          const userIds = tenantAdminUsers.docs.map((u) => u.id)
          expect(userIds).toContain(userWithBookingOnly.id)
          expect(userIds).toContain(userInTestTenant.id)
          expect(userIds).toContain(tenantAdminUser.id)
          expect(userIds).not.toContain(userInSecondTenant.id)
        },
        TEST_TIMEOUT,
      )
    })

    describe('Tenant org admin cannot escalate to super-admin', () => {
      it(
        'org admin cannot add super-admin to self',
        async () => {
          const req = {
            ...payload,
            context: { tenant: testTenant.id },
            user: tenantAdminUser,
          } as any

          try {
            await payload.update({
              collection: 'users',
              id: tenantAdminUser.id,
              data: { roles: ['super-admin', 'admin'] },
              req,
              overrideAccess: false,
            })
          } catch {
            // Roles plugin or field-level access may reject the update
          }

          const refetched = await payload.findByID({
            collection: 'users',
            id: tenantAdminUser.id,
            overrideAccess: true,
          }) as User
          expect(refetched.roles).not.toContain('super-admin')
          expect(refetched.roles).toContain('admin')
        },
        TEST_TIMEOUT,
      )

      it(
        'org admin cannot grant super-admin to another user in their tenant',
        async () => {
          const req = {
            ...payload,
            context: { tenant: testTenant.id },
            user: tenantAdminUser,
          } as any

          try {
            await payload.update({
              collection: 'users',
              id: userInTestTenant.id,
              data: { roles: ['super-admin', 'user'] },
              req,
              overrideAccess: false,
            })
          } catch {
            // Roles plugin or field-level access may reject the update
          }

          const refetched = await payload.findByID({
            collection: 'users',
            id: userInTestTenant.id,
            overrideAccess: true,
          }) as User
          expect(refetched.roles).not.toContain('super-admin')
        },
        TEST_TIMEOUT,
      )
    })

    describe('Tenant org admin can grant org admin within tenant', () => {
      it(
        'org admin can promote another user in their tenant to org admin',
        async () => {
          const req = {
            ...payload,
            context: { tenant: testTenant.id },
            user: tenantAdminUser,
          } as any

          const updated = (await payload.update({
            collection: 'users',
            id: userInTestTenant.id,
            data: { roles: ['user', 'admin'] },
            req,
            overrideAccess: false,
          })) as User

          expect(updated.roles).toContain('admin')

          const refetched = (await payload.findByID({
            collection: 'users',
            id: userInTestTenant.id,
            overrideAccess: true,
          })) as User
          expect(refetched.roles).toContain('admin')
        },
        TEST_TIMEOUT,
      )
    })
  })

  describe('Regular user access', () => {
    it(
      'can read tenant-scoped documents for booking purposes',
      async () => {
        // Create a lesson for testTenant using tenant context
        const classOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `User Read Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const testTenantLesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: new Date().toISOString(),
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            classOption: classOption.id,
            active: true,
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        // Regular user should be able to read lessons for booking
        const req = {
          ...payload,
          payload,
          context: { tenant: testTenant.id },
          user: regularUser,
        } as any

        const userLessons = await payload.find({
          collection: 'timeslots',
          where: {
            tenant: {
              equals: testTenant.id,
            },
          },
          limit: 100,
          req,
          overrideAccess: false, // Enforce access control
        })

        const lessonIds = userLessons.docs.map((l) => l.id)
        expect(lessonIds).toContain(testTenantLesson.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'cannot create or update tenant-scoped configuration documents',
      async () => {
        // Create class option first
        const classOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `User Create Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        // Regular user should not be able to create lessons
        const req = {
          ...payload,
          context: { tenant: testTenant.id },
          user: regularUser,
        } as any

        await expect(
          payload.create({
            collection: 'timeslots',
            data: {
              date: new Date().toISOString(),
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              classOption: classOption.id,
              active: true,
            },
            req,
            overrideAccess: false, // Enforce access control
          }),
        ).rejects.toThrow()

        // Regular user should not be able to create navbar
        await expect(
          payload.create({
            collection: 'navbar',
            data: {
              logoLink: '/',
              navItems: [],
            },
            req,
            overrideAccess: false, // Enforce access control
          }),
        ).rejects.toThrow()
      },
      TEST_TIMEOUT,
    )

    it(
      'does not leak lessons, class options, or instructors without tenant context for regular users or public reads',
      async () => {
        const lessonDate = new Date()
        lessonDate.setHours(10, 0, 0, 0)
        const lessonEndTime = new Date(lessonDate)
        lessonEndTime.setHours(11, 0, 0, 0)

        const classOption = (await createWithTenantContext<ClassOption>(
          'event-types',
          {
            name: `Leak Test Class ${Date.now()}`,
            places: 10,
            description: 'Tenant-scoped class option should not leak',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const lesson = (await createWithTenantContext<Lesson>(
          'timeslots',
          {
            date: lessonDate.toISOString(),
            startTime: lessonDate.toISOString(),
            endTime: lessonEndTime.toISOString(),
            classOption: classOption.id,
            active: true,
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const instructorUser = (await payload.create({
          collection: 'users',
          data: {
            name: `Leak Test Instructor ${Date.now()}`,
            email: `leak-test-instructor-${Date.now()}@test.com`,
            password: 'test',
            roles: ['user'],
            emailVerified: true,
          },
          draft: false,
          overrideAccess: true,
        } as Parameters<typeof payload.create>[0])) as User

        const instructor = await createWithTenantContext(
          'staff-members',
          {
            user: instructorUser.id,
            description: 'Tenant-scoped instructor should not leak',
            active: true,
          },
          testTenant.id,
          { overrideAccess: true }
        )

        const publicReq = {
          ...payload,
          payload,
          headers: new Headers(),
          context: {},
          user: null,
        } as any

        const regularUserReq = {
          ...payload,
          payload,
          headers: new Headers(),
          context: {},
          user: regularUser,
        } as any

        const runNoLeakQuery = async (query: Promise<{ docs: unknown[] }>) => {
          try {
            const result = await query
            return result.docs.length
          } catch {
            return 'forbidden'
          }
        }

        const [publicLessons, publicClassOptions, publicInstructors, regularLessons, regularClassOptions, regularInstructors] =
          await Promise.all([
            runNoLeakQuery(
              payload.find({
                collection: 'timeslots',
                where: { id: { equals: lesson.id } },
                limit: 10,
                req: publicReq,
                overrideAccess: false,
              }),
            ),
            runNoLeakQuery(
              payload.find({
                collection: 'event-types',
                where: { id: { equals: classOption.id } },
                limit: 10,
                req: publicReq,
                overrideAccess: false,
              }),
            ),
            runNoLeakQuery(
              payload.find({
                collection: 'staff-members',
                where: { id: { equals: (instructor as { id: number }).id } },
                limit: 10,
                req: publicReq,
                overrideAccess: false,
              }),
            ),
            runNoLeakQuery(
              payload.find({
                collection: 'timeslots',
                where: { id: { equals: lesson.id } },
                limit: 10,
                req: regularUserReq,
                overrideAccess: false,
              }),
            ),
            runNoLeakQuery(
              payload.find({
                collection: 'event-types',
                where: { id: { equals: classOption.id } },
                limit: 10,
                req: regularUserReq,
                overrideAccess: false,
              }),
            ),
            runNoLeakQuery(
              payload.find({
                collection: 'staff-members',
                where: { id: { equals: (instructor as { id: number }).id } },
                limit: 10,
                req: regularUserReq,
                overrideAccess: false,
              }),
            ),
          ])

        expect(publicLessons === 0 || publicLessons === 'forbidden').toBe(true)
        expect(publicClassOptions === 0 || publicClassOptions === 'forbidden').toBe(true)
        expect(publicInstructors === 0 || publicInstructors === 'forbidden').toBe(true)
        expect(regularLessons === 0 || regularLessons === 'forbidden').toBe(true)
        expect(regularClassOptions === 0 || regularClassOptions === 'forbidden').toBe(true)
        expect(regularInstructors === 0 || regularInstructors === 'forbidden').toBe(true)
      },
      TEST_TIMEOUT,
    )
  })
})

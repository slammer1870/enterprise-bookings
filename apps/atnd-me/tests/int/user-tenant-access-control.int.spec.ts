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
    if (collection === 'lessons' && data.startTime && data.endTime) {
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
        roles: ['admin'],
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
        roles: ['tenant-admin'],
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
      await payload.db.destroy()
    }
  })

  describe('Admin user access', () => {
    it(
      'can read all tenant-scoped documents across all tenants',
      async () => {
        // Create test data for both tenants using tenant context
        const testTenantClassOption = (await createWithTenantContext<ClassOption>(
          'class-options',
          {
            name: `Test Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const testTenantLesson = (await createWithTenantContext<Lesson>(
          'lessons',
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
          'class-options',
          {
            name: `Second Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        const secondTenantLesson = (await createWithTenantContext<Lesson>(
          'lessons',
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
          collection: 'lessons',
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
          'class-options',
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
          collection: 'lessons',
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
          'class-options',
          {
            name: `Tenant Admin Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const testTenantLesson = (await createWithTenantContext<Lesson>(
          'lessons',
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
          'class-options',
          {
            name: `Other Tenant Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          secondTenant.id,
          { overrideAccess: true }
        ))

        const secondTenantLesson = (await createWithTenantContext<Lesson>(
          'lessons',
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
          collection: 'lessons',
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
          'class-options',
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
          collection: 'lessons',
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
          'class-options',
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
            collection: 'lessons',
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

  describe('Regular user access', () => {
    it(
      'can read tenant-scoped documents for booking purposes',
      async () => {
        // Create a lesson for testTenant using tenant context
        const classOption = (await createWithTenantContext<ClassOption>(
          'class-options',
          {
            name: `User Read Class ${Date.now()}`,
            places: 10,
            description: 'Test description',
          },
          testTenant.id,
          { overrideAccess: true }
        ))

        const testTenantLesson = (await createWithTenantContext<Lesson>(
          'lessons',
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
        const userLessons = await payload.find({
          collection: 'lessons',
          where: {
            tenant: {
              equals: testTenant.id,
            },
          },
          limit: 100,
          user: regularUser,
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
          'class-options',
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
            collection: 'lessons',
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
  })
})

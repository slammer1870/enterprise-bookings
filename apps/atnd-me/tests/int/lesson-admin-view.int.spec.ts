import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload, createLocalReq } from 'payload'
import config from '@/payload.config'
import type { User, Lesson, ClassOption, Tenant } from "@/payload-types"
import { getLessons } from '@repo/bookings-plugin/src/data/lessons'
import { getLessonsQuery } from '@repo/shared-utils'


// Mock next/navigation redirect to prevent test failures
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`Redirect called: ${url}`)
  }),
}))

const TEST_TIMEOUT = 60000 // 60 seconds
const HOOK_TIMEOUT = 300000 // 5 minutes

describe('Lesson Admin View - Multi-Tenant Filtering', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let testTenant: Tenant
  let secondTenant: Tenant
  let testTenantClassOption: ClassOption
  let secondTenantClassOption: ClassOption
  let testTenantLesson: Lesson
  let secondTenantLesson: Lesson

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
        slug: `test-tenant-lesson-view-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    secondTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Second Tenant',
        slug: `second-tenant-lesson-view-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Verify tenants were created and have valid IDs
    if (!testTenant || !testTenant.id) {
      throw new Error('Failed to create testTenant')
    }
    if (!secondTenant || !secondTenant.id) {
      throw new Error('Failed to create secondTenant')
    }

    // Wait for async onboarding hook to complete (it runs after tenant creation)
    // This ensures the tenant is fully committed before we use it
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify tenants exist in database before using them
    // The onboarding hook runs asynchronously, so we need to ensure the tenant is committed
    let retries = 0
    const maxRetries = 5
    while (retries < maxRetries) {
      try {
        const verified = await payload.findByID({
          collection: 'tenants',
          id: testTenant.id,
          overrideAccess: true,
        })
        if (verified) {
          // Update testTenant with verified data to ensure we have the latest
          testTenant = verified as Tenant
          break
        }
      } catch (error) {
        retries++
        if (retries >= maxRetries) {
          throw new Error(`Test tenant ${testTenant.id} not found in database after ${maxRetries} retries`)
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Create admin user (can access all tenants)
    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: `admin-lesson-view-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create tenant-admin user (can only access testTenant)
    // Use the verified tenant ID to ensure it exists
    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin User',
        email: `tenant-admin-lesson-view-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenant.id }], // Array of objects with 'tenant' property
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create class options for both tenants
    testTenantClassOption = (await createWithTenantContext<ClassOption>(
      'class-options',
      {
        name: `Test Tenant Class ${Date.now()}`,
        places: 10,
        description: 'Test description',
      },
      testTenant.id,
      { overrideAccess: true }
    ))

    secondTenantClassOption = (await createWithTenantContext<ClassOption>(
      'class-options',
      {
        name: `Second Tenant Class ${Date.now()}`,
        places: 10,
        description: 'Test description',
      },
      secondTenant.id,
      { overrideAccess: true }
    ))

    // Create lessons for both tenants
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startTime = new Date(today)
    startTime.setHours(10, 0, 0, 0) // 10 AM
    const endTime = new Date(today)
    endTime.setHours(11, 0, 0, 0) // 11 AM

    testTenantLesson = (await createWithTenantContext<Lesson>(
      'lessons',
      {
        date: today.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        classOption: testTenantClassOption.id,
        active: true,
      },
      testTenant.id,
      { overrideAccess: true }
    ))

    secondTenantLesson = (await createWithTenantContext<Lesson>(
      'lessons',
      {
        date: today.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        classOption: secondTenantClassOption.id,
        active: true,
      },
      secondTenant.id,
      { overrideAccess: true }
    ))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db?.destroy?.()
    }
  })

  describe('getLessons function with multi-tenant filtering', () => {
    it(
      'admin user should see all lessons across all tenants',
      async () => {
        // Create req object for admin user without tenant context
        const req = await createLocalReq({ user: { ...adminUser, collection: 'users' } }, payload)

        // Build search params that match the date range
        // The getLessons function expects a specific query parameter format
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)

        const searchParams: { [key: string]: string | string[] | undefined } = {}
        // This is the key that getLessons checks for
        searchParams['where[or][0][and][0][startTime][greater_than_equal]'] = startOfDay.toISOString()

        const params = {
          segments: ['admin', 'collections', 'lessons'],
        }

        const lessons = await getLessons(payload, searchParams, params, req)

        // Admin should see both lessons
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).toContain(testTenantLesson.id)
        expect(lessonIds).toContain(secondTenantLesson.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin user should only see lessons from their assigned tenant',
      async () => {
        // Create req object for tenant-admin user
        const req = await createLocalReq({ user: { ...tenantAdminUser, collection: 'users' } }, payload)
        // Don't set tenant context - access control should filter by user's assigned tenants

        // Build search params that match the date range
        // The getLessons function expects a specific query parameter format
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const searchParams: { [key: string]: string | string[] | undefined } = {}
        // This is the key that getLessons checks for
        searchParams['where[or][0][and][0][startTime][greater_than_equal]'] = startOfDay.toISOString()

        const params = {
          segments: ['admin', 'collections', 'lessons'],
        }

        const lessons = await getLessons(payload, searchParams, params, req)

        // Tenant-admin should only see their tenant's lesson
        expect(lessons.length).toBeGreaterThanOrEqual(1)
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).toContain(testTenantLesson.id)
        expect(lessonIds).not.toContain(secondTenantLesson.id)

        // Verify all returned lessons belong to the tenant-admin's tenant
        for (const lesson of lessons) {
          const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
            ? lesson.tenant.id
            : lesson.tenant
          expect(lessonTenantId).toBe(testTenant.id)
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'should filter by tenant when req.context.tenant is set',
      async () => {
        // Create req object with tenant context set
        const req = await createLocalReq({ user: { ...adminUser, collection: 'users' } }, payload)
        if (!req.context) {
          req.context = {}
        }
        req.context.tenant = testTenant.id

        // Build search params that match the date range
        // The getLessons function expects a specific query parameter format
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const searchParams: { [key: string]: string | string[] | undefined } = {}
        // This is the key that getLessons checks for
        searchParams['where[or][0][and][0][startTime][greater_than_equal]'] = startOfDay.toISOString()

        const params = {
          segments: ['admin', 'collections', 'lessons'],
        }

        const lessons = await getLessons(payload, searchParams, params, req)

        // Should only see lessons from the specified tenant
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).toContain(testTenantLesson.id)
        expect(lessonIds).not.toContain(secondTenantLesson.id)

        // Verify all returned lessons belong to the specified tenant
        for (const lesson of lessons) {
          const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
            ? lesson.tenant.id
            : lesson.tenant
          expect(lessonTenantId).toBe(testTenant.id)
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'should respect access control when overrideAccess is false',
      async () => {
        // Test that access control is enforced
        const req = await createLocalReq({ user: { ...tenantAdminUser, collection: 'users' } }, payload)

        // Build search params that match the date range
        // The getLessons function expects a specific query parameter format
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const searchParams: { [key: string]: string | string[] | undefined } = {}
        // This is the key that getLessons checks for
        searchParams['where[or][0][and][0][startTime][greater_than_equal]'] = startOfDay.toISOString()

        const params = {
          segments: ['admin', 'collections', 'lessons'],
        }

        const lessons = await getLessons(payload, searchParams, params, req)

        // Tenant-admin should not see second tenant's lesson even if we try to query for it
        // because access control filters by their assigned tenants
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).not.toContain(secondTenantLesson.id)
      },
      TEST_TIMEOUT,
    )
  })
})

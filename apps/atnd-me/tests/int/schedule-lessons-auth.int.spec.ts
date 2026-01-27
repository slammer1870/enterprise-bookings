import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Lesson, ClassOption, Tenant } from '@repo/shared-types'

/**
 * Tests that authenticated users can see lessons in the schedule on the homepage.
 * This verifies the fix for the issue where authenticated users couldn't see lessons
 * when accessing the schedule via tRPC getByDate procedure.
 */
const TEST_TIMEOUT = 60000 // 60 seconds
const HOOK_TIMEOUT = 300000 // 5 minutes

describe('Schedule lessons visibility for authenticated users', () => {
  let payload: Payload
  let regularUser: User
  let testTenant: Tenant
  let testLesson: Lesson

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create test tenant
    testTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-schedule-${Date.now()}`,
      },
      overrideAccess: true,
    })) as Tenant

    // Create regular authenticated user
    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Regular User',
        email: `user-schedule-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create class option for the tenant
    const classOption = (await payload.create({
      collection: 'class-options',
      data: {
        name: `Schedule Test Class ${Date.now()}`,
        places: 10,
        description: 'Test description',
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as ClassOption

    // Create a lesson for today in the tenant
    const today = new Date()
    today.setHours(10, 0, 0, 0)
    const endTime = new Date(today)
    endTime.setHours(11, 0, 0, 0)

    testLesson = (await payload.create({
      collection: 'lessons',
      data: {
        date: today.toISOString(),
        startTime: today.toISOString(),
        endTime: endTime.toISOString(),
        classOption: classOption.id,
        active: true,
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as Lesson
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        // Cleanup
        await payload.delete({
          collection: 'lessons',
          where: { id: { equals: testLesson.id } },
        })
        await payload.delete({
          collection: 'users',
          where: { id: { equals: regularUser.id } },
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
    'allows authenticated user to see lessons via tRPC getByDate with tenant context',
    async () => {
      // Simulate tRPC call with authenticated user and tenant context
      // This mimics what the Schedule component does
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      // Create tRPC context with authenticated user
      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
      })

      // Mock the auth to return our regular user
      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: regularUser as any,
      } as any)

      try {
        // Call getByDate with today's date
        const today = new Date()
        today.setHours(12, 0, 0, 0) // Use noon to ensure we're in the same day
        
        const caller = appRouter.createCaller(ctx)
        const lessons = await caller.lessons.getByDate({
          date: today.toISOString(),
        })

        // User should be able to see the lesson
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).toContain(testLesson.id)
        expect(lessons.length).toBeGreaterThan(0)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'allows unauthenticated user to see lessons via tRPC getByDate with tenant context',
    async () => {
      // Simulate tRPC call without authenticated user but with tenant context
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
      })

      // Mock the auth to return no user
      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: null,
      } as any)

      try {
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        
        const caller = appRouter.createCaller(ctx)
        const lessons = await caller.lessons.getByDate({
          date: today.toISOString(),
        })

        // Unauthenticated users should also be able to see lessons for booking
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).toContain(testLesson.id)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'allows authenticated user to see lessons even when they do not have tenant in tenants array',
    async () => {
      // This is the key scenario: user is authenticated but viewing a tenant
      // they don't have explicit access to (cross-tenant booking scenario)
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
      })

      // Mock the auth to return regular user (who doesn't have this tenant)
      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: regularUser as any,
      } as any)

      try {
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        
        const caller = appRouter.createCaller(ctx)
        const lessons = await caller.lessons.getByDate({
          date: today.toISOString(),
        })

        // Regular authenticated user should be able to see lessons for the tenant
        // they're currently viewing, even if not in their tenants array
        const lessonIds = lessons.map((l) => l.id)
        expect(lessonIds).toContain(testLesson.id)
        expect(lessons.length).toBeGreaterThan(0)
        
        // Verify all lessons belong to the tenant from subdomain (not user's tenants)
        for (const lesson of lessons) {
          const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
            ? lesson.tenant.id
            : lesson.tenant
          expect(lessonTenantId).toBe(testTenant.id)
        }
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'filters lessons by subdomain tenant context, not user tenants array',
    async () => {
      // Create a second tenant and lesson
      const secondTenant = (await payload.create({
        collection: 'tenants',
        data: {
          name: 'Second Tenant',
          slug: `second-tenant-schedule-${Date.now()}`,
        },
        overrideAccess: true,
      })) as Tenant

      const secondClassOption = (await payload.create({
        collection: 'class-options',
        data: {
          name: `Second Tenant Class ${Date.now()}`,
          places: 10,
          description: 'Test description',
          tenant: secondTenant.id,
        },
        overrideAccess: true,
      })) as ClassOption

      const today = new Date()
      today.setHours(14, 0, 0, 0)
      const endTime = new Date(today)
      endTime.setHours(15, 0, 0, 0)

      const secondLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: today.toISOString(),
          startTime: today.toISOString(),
          endTime: endTime.toISOString(),
          classOption: secondClassOption.id,
          active: true,
          tenant: secondTenant.id,
        },
        overrideAccess: true,
      })) as Lesson

      try {
        // User is authenticated, viewing first tenant's subdomain
        const mockHeaders = new Headers()
        mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

        const ctx = await createTRPCContext({
          headers: mockHeaders,
          payload,
        })

        const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
          user: regularUser as any,
        } as any)

        try {
          const today = new Date()
          today.setHours(12, 0, 0, 0)
          
          const caller = appRouter.createCaller(ctx)
          const lessons = await caller.lessons.getByDate({
            date: today.toISOString(),
          })

          // Should only see lessons from testTenant (from subdomain), not secondTenant
          const lessonIds = lessons.map((l) => l.id)
          expect(lessonIds).toContain(testLesson.id)
          expect(lessonIds).not.toContain(secondLesson.id)
          
          // All lessons should be from the subdomain tenant
          for (const lesson of lessons) {
            const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
              ? lesson.tenant.id
              : lesson.tenant
            expect(lessonTenantId).toBe(testTenant.id)
          }
        } finally {
          authSpy.mockRestore()
        }
      } finally {
        // Cleanup second tenant data
        try {
          await payload.delete({
            collection: 'lessons',
            where: { id: { equals: secondLesson.id } },
          })
          await payload.delete({
            collection: 'class-options',
            where: { id: { equals: secondClassOption.id } },
          })
          await payload.delete({
            collection: 'tenants',
            where: { id: { equals: secondTenant.id } },
          })
        } catch {
          // ignore cleanup errors
        }
      }
    },
    TEST_TIMEOUT,
  )
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Lesson, ClassOption, Booking } from '@repo/shared-types'
import { addDays } from 'date-fns'

const TEST_TIMEOUT = 120000 // 2 minutes (jobs can take time)
const HOOK_TIMEOUT = 300000 // 5 minutes

describe('Scheduler Lesson Generation with Tenant Context', () => {
  let payload: Payload
  let testTenant: { id: number | string; slug: string }
  let secondTenant: { id: number | string; slug: string }
  let user: User
  let classOption: ClassOption
  let secondTenantClassOption: ClassOption

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create first test tenant
    testTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-scheduler-${Date.now()}`,
      },
      overrideAccess: true,
    })

    // Create second tenant to test isolation
    secondTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Second Tenant',
        slug: `second-tenant-scheduler-${Date.now()}`,
      },
      overrideAccess: true,
    })

    // Create test user
    const uniqueEmail = `test-scheduler-${Date.now()}@test.com`
    user = (await payload.create({
      collection: 'users',
      data: {
        name: 'Test User',
        email: uniqueEmail,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create class option for first tenant
    classOption = (await payload.create({
      collection: 'class-options',
      data: {
        name: `Test Class Option ${Date.now()}`,
        places: 10,
        description: 'Test Description',
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as ClassOption

    // Create class option for second tenant
    secondTenantClassOption = (await payload.create({
      collection: 'class-options',
      data: {
        name: `Second Tenant Class Option ${Date.now()}`,
        places: 10,
        description: 'Second Tenant Description',
        tenant: secondTenant.id,
      },
      overrideAccess: true,
    })) as ClassOption
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy()
    }
  })

  it(
    'generates lessons for the correct tenant and handles conflicting lessons with active bookings',
    async () => {
      // Set up dates: start from tomorrow, end 3 days later
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      const endDate = new Date(tomorrow)
      endDate.setDate(endDate.getDate() + 3)
      endDate.setHours(23, 59, 59, 999)

      // Create existing lessons for the test tenant (some with bookings, some without)
      const existingLessonWithoutBooking = (await payload.create({
        collection: 'lessons',
        data: {
          date: tomorrow.toISOString(),
          startTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
          endTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
          classOption: classOption.id,
          tenant: testTenant.id,
          active: true,
        },
        overrideAccess: true,
      })) as Lesson

      const existingLessonWithBooking = (await payload.create({
        collection: 'lessons',
        data: {
          date: tomorrow.toISOString(),
          startTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM
          endTime: new Date(tomorrow.getTime() + 15 * 60 * 60 * 1000).toISOString(), // 3 PM
          classOption: classOption.id,
          tenant: testTenant.id,
          active: true,
        },
        overrideAccess: true,
      })) as Lesson

      // Create a confirmed booking for the lesson with booking
      const booking = (await payload.create({
        collection: 'bookings',
        data: {
          lesson: existingLessonWithBooking.id,
          user: user.id,
          status: 'confirmed',
          quantity: 1,
          tenant: testTenant.id,
        },
        overrideAccess: true,
      })) as Booking

      // Create a lesson for the second tenant (should not be affected)
      // Use a different time slot to avoid conflicts
      const secondTenantLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: tomorrow.toISOString(),
          startTime: new Date(tomorrow.getTime() + 16 * 60 * 60 * 1000).toISOString(), // 4 PM (different from test tenant's times)
          endTime: new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000).toISOString(), // 5 PM
          classOption: secondTenantClassOption.id,
          tenant: secondTenant.id,
          active: true,
        },
        overrideAccess: true,
      })) as Lesson

      // Verify the second tenant's lesson exists before running the job
      const secondTenantLessonBefore = await payload.findByID({
        collection: 'lessons',
        id: secondTenantLesson.id,
        overrideAccess: true,
      })
      expect(secondTenantLessonBefore).toBeDefined()
      expect(secondTenantLessonBefore.id).toBe(secondTenantLesson.id)

      // Create scheduler for test tenant - let hook set tenant from context
      // Schedule: Monday 10-11 AM, Wednesday 2-3 PM
      const req = {
        ...payload,
        context: { tenant: testTenant.id },
      } as any

      const scheduler = await payload.create({
        collection: 'scheduler',
        data: {
          tenant: testTenant.id, // Explicitly set tenant for isGlobal collections
          startDate: tomorrow.toISOString(),
          endDate: endDate.toISOString(),
          clearExisting: true, // Should delete lessons without bookings
          defaultClassOption: classOption.id,
          lockOutTime: 60,
          week: {
            days: [
              {
                // Monday (index 0)
                timeSlot: [
                  {
                    startTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
                    endTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
                    classOption: classOption.id,
                    location: 'Test Location',
                    active: true,
                  },
                ],
              },
              {
                // Tuesday (index 1) - empty
                timeSlot: [],
              },
              {
                // Wednesday (index 2)
                timeSlot: [
                  {
                    startTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM
                    endTime: new Date(tomorrow.getTime() + 15 * 60 * 60 * 1000).toISOString(), // 3 PM
                    classOption: classOption.id,
                    location: 'Test Location',
                    active: true,
                  },
                ],
              },
              {
                // Thursday (index 3) - empty
                timeSlot: [],
              },
              {
                // Friday (index 4) - empty
                timeSlot: [],
              },
              {
                // Saturday (index 5) - empty
                timeSlot: [],
              },
              {
                // Sunday (index 6) - empty
                timeSlot: [],
              },
            ],
          },
        },
        req,
        overrideAccess: true,
      })

      // Wait for the job to complete (it runs synchronously via runByID)
      // Give it some time to process
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Verify: Lesson without booking should be deleted (clearExisting: true)
      const deletedLesson = await payload.findByID({
        collection: 'lessons',
        id: existingLessonWithoutBooking.id,
      }).catch(() => null)
      expect(deletedLesson).toBeNull()

      // Verify: Lesson with active booking should still exist
      const preservedLesson = await payload.findByID({
        collection: 'lessons',
        id: existingLessonWithBooking.id,
      })
      expect(preservedLesson).toBeDefined()
      expect(preservedLesson.id).toBe(existingLessonWithBooking.id)

      // Verify: Booking should still exist
      const preservedBooking = await payload.findByID({
        collection: 'bookings',
        id: booking.id,
      })
      expect(preservedBooking).toBeDefined()
      expect(preservedBooking.status).toBe('confirmed')

      // Verify: Second tenant's lesson should not be affected
      // Use overrideAccess to bypass filtering for verification
      const secondTenantLessonPreserved = await payload.findByID({
        collection: 'lessons',
        id: secondTenantLesson.id,
        overrideAccess: true,
      })
      expect(secondTenantLessonPreserved).toBeDefined()
      expect(secondTenantLessonPreserved.id).toBe(secondTenantLesson.id)
      const lessonTenant = typeof secondTenantLessonPreserved.tenant === 'object' && secondTenantLessonPreserved.tenant !== null
        ? secondTenantLessonPreserved.tenant.id
        : secondTenantLessonPreserved.tenant
      expect(lessonTenant).toBe(secondTenant.id)

      // Verify: New lessons should be generated for the test tenant
      // Find all lessons for the test tenant in the date range
      const generatedLessons = await payload.find({
        collection: 'lessons',
        where: {
          and: [
            {
              tenant: {
                equals: testTenant.id,
              },
            },
            {
              startTime: {
                greater_than_equal: tomorrow.toISOString(),
              },
            },
            {
              endTime: {
                less_than_equal: endDate.toISOString(),
              },
            },
          ],
        },
        limit: 100,
      })

      // Should have at least the preserved lesson + new generated lessons
      // The exact count depends on which days fall in the range
      expect(generatedLessons.docs.length).toBeGreaterThan(0)

      // Verify all generated lessons belong to the test tenant
      for (const lesson of generatedLessons.docs) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant
        expect(lessonTenantId).toBe(testTenant.id)
      }

      // Verify: No lessons were generated for the second tenant
      // Use overrideAccess and explicit tenant filter to verify isolation
      const secondTenantLessons = await payload.find({
        collection: 'lessons',
        where: {
          and: [
            {
              tenant: {
                equals: secondTenant.id,
              },
            },
            {
              startTime: {
                greater_than_equal: tomorrow.toISOString(),
              },
            },
            {
              endTime: {
                less_than_equal: endDate.toISOString(),
              },
            },
          ],
        },
        limit: 100,
        overrideAccess: true,
      })

      // Should only have the original lesson we created, not any new ones
      expect(secondTenantLessons.docs.length).toBe(1)
      expect(secondTenantLessons.docs[0]?.id).toBe(secondTenantLesson.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not delete lessons when clearExisting is false',
    async () => {
      // Set up dates: start from 4 days from now
      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 4)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 2)
      endDate.setHours(23, 59, 59, 999)

      // Create an existing lesson
      const existingLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startDate.toISOString(),
          startTime: new Date(startDate.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
          endTime: new Date(startDate.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
          classOption: classOption.id,
          tenant: testTenant.id,
          active: true,
        },
        overrideAccess: true,
      })) as Lesson

      // Delete any existing scheduler for this tenant first (isGlobal: true means one per tenant)
      try {
        const existing = await payload.find({
          collection: 'scheduler',
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
            collection: 'scheduler',
            id: existing.docs[0]!.id,
            overrideAccess: true,
          })
        }
      } catch {
        // Ignore if none exists
      }

      // Create scheduler with clearExisting: false - explicitly set tenant
      const req = {
        ...payload,
        context: { tenant: testTenant.id },
      } as any

      await payload.create({
        collection: 'scheduler',
        data: {
          tenant: testTenant.id, // Explicitly set tenant for isGlobal collections
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          clearExisting: false, // Should NOT delete existing lessons
          defaultClassOption: classOption.id,
          lockOutTime: 60,
          // Don't set tenant in data - let the beforeChange hook set it from req.context.tenant
          week: {
            days: [
              {
                // Monday
                timeSlot: [
                  {
                    startTime: new Date(startDate.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
                    endTime: new Date(startDate.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
                    classOption: classOption.id,
                    location: 'Test Location',
                    active: true,
                  },
                ],
              },
              // Rest of days empty
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
            ],
          },
        },
        overrideAccess: true,
      })

      // Wait for the job to complete
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Verify: Existing lesson should still exist
      const preservedLesson = await payload.findByID({
        collection: 'lessons',
        id: existingLesson.id,
      })
      expect(preservedLesson).toBeDefined()
      expect(preservedLesson.id).toBe(existingLesson.id)
    },
    TEST_TIMEOUT,
  )
})

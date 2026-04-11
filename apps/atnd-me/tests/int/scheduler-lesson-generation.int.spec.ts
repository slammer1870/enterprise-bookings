import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Timeslot, EventType, Booking } from '@repo/shared-types'

const TEST_TIMEOUT = 120000 // 2 minutes (jobs can take time)
const HOOK_TIMEOUT = 300000 // 5 minutes

describe('Scheduler Timeslot Generation with Tenant Context', () => {
  let payload: Payload
  let testTenant: { id: number | string; slug: string }
  let secondTenant: { id: number | string; slug: string }
  let user: User
  let eventType: EventType
  let secondTenantEventType: EventType

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
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    // Create class option for first tenant
    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Test Class Option ${Date.now()}`,
        places: 10,
        description: 'Test Description',
        tenant: Number(testTenant.id),
      },
      overrideAccess: true,
    })) as EventType

    // Create class option for second tenant
    secondTenantEventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Second Tenant Class Option ${Date.now()}`,
        places: 10,
        description: 'Second Tenant Description',
        tenant: Number(secondTenant.id),
      },
      overrideAccess: true,
    })) as EventType
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy?.()
    }
  })

  it(
    'generates timeslots for the correct tenant and handles conflicting timeslots with active bookings',
    async () => {
      // Set up dates: start from tomorrow, end 3 days later
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      const endDate = new Date(tomorrow)
      endDate.setDate(endDate.getDate() + 3)
      endDate.setHours(23, 59, 59, 999)

      // Create existing timeslots for the test tenant (some with bookings, some without)
      const existingTimeslotWithoutBooking = (await payload.create({
        collection: 'timeslots',
        data: {
          date: tomorrow.toISOString(),
          startTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
          endTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
          eventType: eventType.id,
          tenant: Number(testTenant.id),
          active: true,
        },
        overrideAccess: true,
      })) as Timeslot

      const existingTimeslotWithBooking = (await payload.create({
        collection: 'timeslots',
        data: {
          date: tomorrow.toISOString(),
          startTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM
          endTime: new Date(tomorrow.getTime() + 15 * 60 * 60 * 1000).toISOString(), // 3 PM
          eventType: eventType.id,
          tenant: Number(testTenant.id),
          active: true,
        },
        overrideAccess: true,
      })) as Timeslot

      // Create a confirmed booking for the lesson with booking
      const booking = (await payload.create({
        collection: 'bookings',
        data: {
          timeslot: existingTimeslotWithBooking.id,
          user: user.id,
          status: 'confirmed',
          quantity: 1,
          tenant: Number(testTenant.id),
        },
        overrideAccess: true,
      })) as Booking

      // Create a lesson for the second tenant (should not be affected)
      // Use a different time slot to avoid conflicts
      const secondTenantTimeslot = (await payload.create({
        collection: 'timeslots',
        data: {
          date: tomorrow.toISOString(),
          startTime: new Date(tomorrow.getTime() + 16 * 60 * 60 * 1000).toISOString(), // 4 PM (different from test tenant's times)
          endTime: new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000).toISOString(), // 5 PM
          eventType: secondTenantEventType.id,
          tenant: Number(secondTenant.id),
          active: true,
        },
        overrideAccess: true,
      })) as Timeslot

      // Verify the second tenant's lesson exists before running the job
      const secondTenantTimeslotBefore = await payload.findByID({
        collection: 'timeslots',
        id: secondTenantTimeslot.id,
        overrideAccess: true,
      })
      expect(secondTenantTimeslotBefore).toBeDefined()
      expect(secondTenantTimeslotBefore.id).toBe(secondTenantTimeslot.id)

      // Count timeslots for second tenant before running scheduler
      const secondTenantTimeslotsBefore = await payload.find({
        collection: 'timeslots',
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
      const initialTimeslotCount = secondTenantTimeslotsBefore.docs.length

      // Create scheduler for test tenant - let hook set tenant from context
      // Schedule: Monday 10-11 AM, Wednesday 2-3 PM
      const req = {
        ...payload,
        context: { tenant: testTenant.id },
      } as any

      const _scheduler = await payload.create({
        collection: 'scheduler',
        data: {
          tenant: Number(testTenant.id), // Explicitly set tenant for isGlobal collections
          startDate: tomorrow.toISOString(),
          endDate: endDate.toISOString(),
          clearExisting: true, // Should delete timeslots without bookings
          defaultEventType: eventType.id,
          lockOutTime: 60,
          week: {
            days: [
              {
                // Monday (index 0)
                timeSlot: [
                  {
                    startTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
                    endTime: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
                    eventType: eventType.id,
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
                    eventType: eventType.id,
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

      // Verify: Timeslot without booking should be deleted (clearExisting: true)
      const deletedTimeslot = await payload.findByID({
        collection: 'timeslots',
        id: existingTimeslotWithoutBooking.id,
      }).catch(() => null)
      expect(deletedTimeslot).toBeNull()

      // Verify: Timeslot with active booking should still exist
      const preservedTimeslot = await payload.findByID({
        collection: 'timeslots',
        id: existingTimeslotWithBooking.id,
      })
      expect(preservedTimeslot).toBeDefined()
      expect(preservedTimeslot.id).toBe(existingTimeslotWithBooking.id)

      // Verify: Booking should still exist
      const preservedBooking = await payload.findByID({
        collection: 'bookings',
        id: booking.id,
      })
      expect(preservedBooking).toBeDefined()
      expect(preservedBooking.status).toBe('confirmed')

      // Verify: Second tenant's lesson should not be affected
      // Use overrideAccess to bypass filtering for verification
      const secondTenantTimeslotPreserved = await payload.findByID({
        collection: 'timeslots',
        id: secondTenantTimeslot.id,
        overrideAccess: true,
      })
      expect(secondTenantTimeslotPreserved).toBeDefined()
      expect(secondTenantTimeslotPreserved.id).toBe(secondTenantTimeslot.id)
      const lessonTenant = typeof secondTenantTimeslotPreserved.tenant === 'object' && secondTenantTimeslotPreserved.tenant !== null
        ? secondTenantTimeslotPreserved.tenant.id
        : secondTenantTimeslotPreserved.tenant
      expect(lessonTenant).toBe(secondTenant.id)

      // Verify: New timeslots should be generated for the test tenant
      // Find all timeslots for the test tenant in the date range
      const generatedTimeslots = await payload.find({
        collection: 'timeslots',
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

      // Should have at least the preserved lesson + new generated timeslots
      // The exact count depends on which days fall in the range
      expect(generatedTimeslots.docs.length).toBeGreaterThan(0)

      // Verify all generated timeslots belong to the test tenant
      for (const lesson of generatedTimeslots.docs) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant
        expect(lessonTenantId).toBe(testTenant.id)
      }

      // Verify: No timeslots were generated for the second tenant
      // Use overrideAccess and explicit tenant filter to verify isolation
      const secondTenantTimeslots = await payload.find({
        collection: 'timeslots',
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

      // Should have the same number of timeslots as before (no new ones generated)
      expect(secondTenantTimeslots.docs.length).toBe(initialTimeslotCount)
      // Verify our specific lesson still exists
      const ourTimeslot = secondTenantTimeslots.docs.find(l => l.id === secondTenantTimeslot.id)
      expect(ourTimeslot).toBeDefined()
      expect(ourTimeslot?.id).toBe(secondTenantTimeslot.id)
    },
    TEST_TIMEOUT,
  )

  it(
    'does not delete timeslots when clearExisting is false',
    async () => {
      // Set up dates: start from 4 days from now
      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 4)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 2)
      endDate.setHours(23, 59, 59, 999)

      // Create an existing lesson
      const existingTimeslot = (await payload.create({
        collection: 'timeslots',
        data: {
          date: startDate.toISOString(),
          startTime: new Date(startDate.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
          endTime: new Date(startDate.getTime() + 11 * 60 * 60 * 1000).toISOString(), // 11 AM
          eventType: eventType.id,
          tenant: Number(testTenant.id),
          active: true,
        },
        overrideAccess: true,
      })) as Timeslot

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
      const _req = {
        ...payload,
        context: { tenant: testTenant.id },
      } as any

      await payload.create({
        collection: 'scheduler',
        data: {
          tenant: Number(testTenant.id), // Explicitly set tenant for isGlobal collections
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          clearExisting: false, // Should NOT delete existing timeslots
          defaultEventType: eventType.id,
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
                    eventType: eventType.id,
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
      const preservedTimeslot = await payload.findByID({
        collection: 'timeslots',
        id: existingTimeslot.id,
      })
      expect(preservedTimeslot).toBeDefined()
      expect(preservedTimeslot.id).toBe(existingTimeslot.id)
    },
    TEST_TIMEOUT,
  )
})

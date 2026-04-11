import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Timeslot, EventType } from '@repo/shared-types'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

const TEST_TIMEOUT = 60000 // 60 seconds
const HOOK_TIMEOUT = 300000 // 5 minutes
const runId = Math.random().toString(36).slice(2, 10)
const subscriptionConnectAccountId = `acct_e2e_connected_subscription_${runId}`
const scheduleShortcutAccountId = `acct_e2e_connected_schedule_shortcut_${runId}`
const scheduleShortcutPastDueAccountId = `acct_e2e_connected_schedule_shortcut_past_due_${runId}`

describe('tRPC Bookings Integration Tests', () => {
  let payload: Payload
  let user: User
  let lesson: Timeslot
  let eventType: EventType
  let testTenant: { id: number | string; slug: string }
  // Helper to create tenant-scoped documents with tenant automatically added
  const createWithTenant = async <T = any>(
    collection: 'timeslots' | 'event-types' | 'bookings' | 'staff-members',
    data: any,
    options?: Omit<Parameters<typeof payload.create>[0], 'collection' | 'data'>
  ): Promise<T> => {
    const tenantScopedCollections = [
      'timeslots',
      'event-types',
      'bookings',
      'staff-members',
    ] as const
    if ((tenantScopedCollections as readonly string[]).includes(collection)) {
      data = { ...data, tenant: testTenant.id }
    }
    return payload.create({
      collection,
      data,
      ...options,
    } as Parameters<typeof payload.create>[0]) as Promise<T>
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create a test tenant for multi-tenant scoping
    testTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })

    // Create test user with user role (needed for booking access)
    // Better Auth requires specific fields - use unique email to avoid conflicts
    const uniqueEmail = `test-bookings-${Date.now()}@test.com`
    user = (await payload.create({
      collection: 'users',
      data: {
        name: 'Test User',
        email: uniqueEmail, // Use unique email to avoid conflicts
        password: 'test', // Simple password like integration-testing
        role: ['user'], // Assign user role for booking access
        emailVerified: true, // Better Auth may require this
      },
      draft: false, // Explicitly set to non-draft
      overrideAccess: true, // Bypass access controls for test setup
    } as Parameters<typeof payload.create>[0])) as User

    // Create class option with tenant
    // Use overrideAccess to bypass access controls for test setup
    // Use unique name with timestamp to avoid conflicts
    const uniqueName = `Test Class Option ${Date.now()}`
    eventType = (await createWithTenant<EventType>(
      'event-types',
      {
        name: uniqueName,
        places: 10,
        description: 'Test Description',
      },
      {
        overrideAccess: true, // Bypass access controls for test setup
      }
    ))

    // Create lesson with tenant
    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0) // 10 AM
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0) // 11 AM

    lesson = (await createWithTenant<Timeslot>(
      'timeslots',
      {
        date: startTime.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        eventType: eventType.id,
        location: 'Test Location',
        active: true,
        lockOutTime: 0, // Required field with default value
      },
      {
        draft: false, // Explicitly set to non-draft
        overrideAccess: true, // Bypass access controls for test setup
      }
    ))
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      // Cleanup test data
      try {
        await payload.delete({
          collection: 'timeslots',
          where: { id: { equals: lesson.id } },
        })
      } catch (_e) {
        // Ignore cleanup errors
      }
      try {
        await payload.delete({
          collection: 'event-types',
          where: { id: { equals: eventType.id } },
        })
      } catch (_e) {
        // Ignore cleanup errors
      }
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: user.id } },
        })
      } catch (_e) {
        // Ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  const createCaller = async () => {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=${testTenant.slug}`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      user,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    })
    return appRouter.createCaller(ctx)
  }

  /** Caller with no user override – uses real auth (Better Auth / Payload). No session in tests → unauthenticated. */
  const createUnauthenticatedCaller = async () => {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=${testTenant.slug}`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    })
    return appRouter.createCaller(ctx)
  }

  describe('Auth: unauthenticated access is rejected', () => {
    it('timeslots.getByIdForBooking throws when not logged in', async () => {
      const caller = await createUnauthenticatedCaller()
      await expect(caller.timeslots.getByIdForBooking({ id: lesson.id })).rejects.toThrow(
        'You must be logged in to access this resource'
      )
    })

    it('timeslots.getById throws when not logged in', async () => {
      const caller = await createUnauthenticatedCaller()
      await expect(caller.timeslots.getById({ id: lesson.id })).rejects.toThrow(
        'You must be logged in to access this resource'
      )
    })

    it('bookings.createBookings throws when not logged in', async () => {
      const caller = await createUnauthenticatedCaller()
      await expect(
        caller.bookings.createBookings({ timeslotId: lesson.id, quantity: 1 })
      ).rejects.toThrow('You must be logged in to access this resource')
    })

    it('bookings.getUserBookingsForTimeslot throws when not logged in', async () => {
      const caller = await createUnauthenticatedCaller()
      await expect(
        caller.bookings.getUserBookingsForTimeslot({ timeslotId: lesson.id })
      ).rejects.toThrow('You must be logged in to access this resource')
    })

    it('bookings.cancelBooking throws when not logged in', async () => {
      const caller = await createUnauthenticatedCaller()
      await expect(caller.bookings.cancelBooking({ id: 99999 })).rejects.toThrow(
        'You must be logged in to access this resource'
      )
    })

    it('bookings.setMyBookingQuantityForTimeslot throws when not logged in', async () => {
      const caller = await createUnauthenticatedCaller()
      await expect(
        caller.bookings.setMyBookingQuantityForTimeslot({
          timeslotId: lesson.id,
          desiredQuantity: 1,
        })
      ).rejects.toThrow('You must be logged in to access this resource')
    })
  })

  describe('timeslots.getByIdForBooking', () => {
    it('should fetch a lesson successfully', async () => {
      // Create a fresh lesson for this test to ensure clean state
      // Use tomorrow to ensure lesson is not closed (hasn't started yet)
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1) // Tomorrow
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      const result = await caller.timeslots.getByIdForBooking({ id: testTimeslot.id })

      expect(result).toBeDefined()
      expect(result.id).toBe(testTimeslot.id)
      expect(result.eventType).toBeDefined()

      // Cleanup
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error for non-existent lesson', async () => {
      const caller = await createCaller()

      await expect(caller.timeslots.getByIdForBooking({ id: 99999 })).rejects.toThrow()
    }, TEST_TIMEOUT)

    it(
      'should throw error when lesson is fully booked',
      async () => {
        // Use a small class option (3 places) to avoid creating many users/bookings and reduce timeout risk
        const smallEventType = (await createWithTenant<EventType>(
          'event-types',
          {
            name: `Fully Booked Class ${Date.now()}`,
            places: 3,
            description: 'Small capacity for fully-booked test',
          },
          { overrideAccess: true }
        ))

        const startTime = new Date()
        startTime.setDate(startTime.getDate() + 1) // Tomorrow (avoid "closed" based on current time)
        startTime.setHours(11, 0, 0, 0)
        const endTime = new Date(startTime)
        endTime.setHours(12, 0, 0, 0)

        const testTimeslot = (await createWithTenant<Timeslot>(
          'timeslots',
          {
            date: startTime.toISOString(),
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            eventType: smallEventType.id,
            location: 'Test Location',
            active: true,
            lockOutTime: 0, // Required field with default value
          },
          {
            draft: false,
            overrideAccess: true,
          }
        ))

        const caller = await createCaller()

        // Fill up the lesson using overrideAccess for test setup
        const createdUserIds: Array<number | string> = []
        const places = smallEventType.places ?? 3
        for (let i = 0; i < places; i++) {
          const otherUser = await payload.create({
            collection: 'users',
            data: {
              name: `Fully Booked User ${i}`,
              email: `fully-booked-${Date.now()}-${i}@test.com`,
              password: 'test',
              role: ['user'],
              emailVerified: true,
            },
            draft: false,
            overrideAccess: true,
          })
          createdUserIds.push(otherUser.id)

          await payload.create({
            collection: 'bookings',
            data: {
              timeslot: testTimeslot.id,
              user: otherUser.id,
              tenant: testTenant.id,
              status: 'confirmed',
            },
            overrideAccess: true,
          })
        }

        await expect(caller.timeslots.getByIdForBooking({ id: testTimeslot.id })).rejects.toThrow(
          'This timeslot is fully booked'
        )

        // Cleanup
        await payload.delete({
          collection: 'bookings',
          where: { timeslot: { equals: testTimeslot.id } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'users',
          where: { id: { in: createdUserIds } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'timeslots',
          where: { id: { equals: testTimeslot.id } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'event-types',
          where: { id: { equals: smallEventType.id } },
          overrideAccess: true,
        })
      },
      90_000,
    )
  })

  describe('bookings.createBookings', () => {
    it('should create a single booking', async () => {
      // Create a fresh lesson for this test to avoid capacity issues
      const startTime = new Date()
      startTime.setHours(12, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(13, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true, // Bypass access controls for test setup
        }
      ))

      const caller = await createCaller()

      const result = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0]?.timeslot).toBe(testTimeslot.id)
      expect(result[0]?.user).toBe(user.id)
      expect(result[0]?.status).toBe('confirmed')

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { equals: result[0]?.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should create multiple bookings', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
        }
      ))

      const caller = await createCaller()

      const result = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 3,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(3)
      result.forEach((booking) => {
        expect(booking.timeslot).toBe(testTimeslot.id)
        expect(booking.user).toBe(user.id)
        expect(booking.status).toBe('confirmed')
      })

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { in: result.map((b) => b.id) } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error when quantity exceeds remaining capacity', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
        }
      ))

      const caller = await createCaller()

      // Book most of the slots using overrideAccess to bypass access controls for test setup
      for (let i = 0; i < eventType.places - 2; i++) {
        await payload.create({
          collection: 'bookings',
          data: {
            timeslot: testTimeslot.id,
            user: user.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })
      }

      // Try to book more than remaining capacity
      await expect(
        caller.bookings.createBookings({
          timeslotId: testTimeslot.id,
          quantity: 5, // More than remaining (2)
        })
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error when quantity is less than 1', async () => {
      const caller = await createCaller()

      await expect(
        caller.bookings.createBookings({
          timeslotId: lesson.id,
          quantity: 0,
        })
      ).rejects.toThrow()
    }, TEST_TIMEOUT)

    it('should throw error for non-existent lesson', async () => {
      const caller = await createCaller()

      await expect(
        caller.bookings.createBookings({
          timeslotId: 99999,
          quantity: 1,
        })
      ).rejects.toThrow()
    }, TEST_TIMEOUT)

    it('should create bookings with pending status when specified', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(18, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(19, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      const result = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
        status: 'pending',
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      result.forEach((booking) => {
        expect(booking.timeslot).toBe(testTimeslot.id)
        expect(booking.user).toBe(user.id)
        expect(booking.status).toBe('pending')
      })

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { in: result.map((b) => b.id) } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.getUserBookingsForTimeslot', () => {
    it('should fetch user bookings for a lesson', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(20, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(21, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      // Create some bookings for the user
      const booking1 = await payload.create({
        collection: 'bookings',
        data: {
          timeslot: testTimeslot.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const booking2 = await payload.create({
        collection: 'bookings',
        data: {
          timeslot: testTimeslot.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      const result = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      expect(result.some((b) => b.id === booking1.id)).toBe(true)
      expect(result.some((b) => b.id === booking2.id)).toBe(true)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { in: [booking1.id, booking2.id] } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should not return cancelled bookings', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(10, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      // Create confirmed and cancelled bookings
      const confirmedBooking = await payload.create({
        collection: 'bookings',
        data: {
          timeslot: testTimeslot.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const cancelledBooking = await payload.create({
        collection: 'bookings',
        data: {
          timeslot: testTimeslot.id,
          user: user.id,
          status: 'cancelled',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      const result = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0]?.id).toBe(confirmedBooking.id)
      expect(result.some((b) => b.id === cancelledBooking.id)).toBe(false)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { in: [confirmedBooking.id, cancelledBooking.id] } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.cancelBooking', () => {
    it('should cancel a booking', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1) // Tomorrow
      startTime.setHours(10, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      // Create a booking
      const booking = await payload.create({
        collection: 'bookings',
        data: {
          timeslot: testTimeslot.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      // Cancel by booking ID (API expects booking id, not lesson id)
      const result = await caller.bookings.cancelBooking({ id: Number(booking.id) })

      expect(result).toBeDefined()
      expect(result.status).toBe('cancelled')
      expect(result.id).toBe(booking.id)

      // Verify it's cancelled in the database
      const cancelledBooking = await payload.findByID({
        collection: 'bookings',
        id: booking.id,
      })
      expect(cancelledBooking.status).toBe('cancelled')

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { equals: booking.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error when booking does not exist', async () => {
      const caller = await createCaller()

      await expect(caller.bookings.cancelBooking({ id: 99999 })).rejects.toThrow()
    }, TEST_TIMEOUT)

    it('should throw error when trying to cancel another user\'s booking', async () => {
      // Create another user
      const otherUser = (await payload.create({
        collection: 'users',
        data: {
          name: 'Other User',
          email: `other-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
      draft: false,
      overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      // Create a fresh lesson
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(12, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(13, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      // Create a booking for the other user
      const otherUserBooking = await payload.create({
        collection: 'bookings',
        data: {
          timeslot: testTimeslot.id,
          user: otherUser.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      // Try to cancel the other user's booking by its ID (should fail)
      await expect(
        caller.bookings.cancelBooking({ id: Number(otherUserBooking.id) })
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { equals: otherUserBooking.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: otherUser.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.cancelPendingBookingsForTimeslot', () => {
    it('cancels all of the current user’s pending bookings for the lesson', async () => {
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))

      const confirmed = await createWithTenant<any>('bookings', {
        timeslot: testTimeslot.id,
        user: user.id,
        status: 'confirmed',
      })
      const pending1 = await createWithTenant<any>('bookings', {
        timeslot: testTimeslot.id,
        user: user.id,
        status: 'pending',
      })
      const pending2 = await createWithTenant<any>('bookings', {
        timeslot: testTimeslot.id,
        user: user.id,
        status: 'pending',
      })

      const caller = await createCaller()
      const result = await caller.bookings.cancelPendingBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })

      expect(result).toEqual({ cancelled: 2 })

      const after = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      expect(after.length).toBe(1)
      expect(after[0]?.id).toBe(confirmed.id)
      expect(after[0]?.status).toBe('confirmed')

      const dbPending1 = await payload.findByID({
        collection: 'bookings',
        id: pending1.id,
      })
      const dbPending2 = await payload.findByID({
        collection: 'bookings',
        id: pending2.id,
      })
      expect(dbPending1.status).toBe('cancelled')
      expect(dbPending2.status).toBe('cancelled')

      await payload.delete({
        collection: 'bookings',
        where: { id: { in: [confirmed.id, pending1.id, pending2.id] } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('returns { cancelled: 0 } when user has no pending bookings for the lesson', async () => {
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))

      const caller = await createCaller()
      const result = await caller.bookings.cancelPendingBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })

      expect(result).toEqual({ cancelled: 0 })

      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings modification flow (MVP)', () => {
    it('should allow increasing booking quantity', async () => {
      // Create a fresh lesson with capacity
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create initial booking
      const initialBookings = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })

      expect(initialBookings.length).toBe(1)

      // Get current bookings
      const bookingsBefore = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      expect(bookingsBefore.length).toBe(1)

      // Increase quantity by creating 2 more bookings
      const additionalBookings = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
      })

      expect(additionalBookings.length).toBe(2)

      // Verify total bookings
      const bookingsAfter = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      expect(bookingsAfter.length).toBe(3)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should allow decreasing booking quantity by cancelling', async () => {
      // Create a fresh lesson
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create 3 bookings
      const bookings = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 3,
      })

      expect(bookings.length).toBe(3)

      // Verify initial count
      const bookingsBefore = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      expect(bookingsBefore.length).toBe(3)

      // Cancel one booking (decrease quantity by 1) using a specific booking ID
      await caller.bookings.cancelBooking({ id: bookings[0]!.id })

      // Verify decreased count
      const bookingsAfter = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      expect(bookingsAfter.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should prevent increasing quantity beyond remaining capacity', async () => {
      // Create a fresh lesson with limited capacity (small places to keep test fast)
      const smallEventType = (await createWithTenant<EventType>(
        'event-types',
        {
          name: `Small Cap ${Date.now()}`,
          places: 3,
          description: 'Test',
        },
        { overrideAccess: true }
      ))
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(18, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(19, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: smallEventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create 1 booking for test user
      await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })

      // Fill remaining capacity with another user's bookings (avoids potential hangs when same user has all)
      const otherUser = (await payload.create({
        collection: 'users',
        data: {
          name: 'Other Cap User',
          email: `other-cap-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      const remainingCapacity = smallEventType.places - 1
      for (let i = 0; i < remainingCapacity; i++) {
        await createWithTenant('bookings', {
          timeslot: testTimeslot.id,
          user: otherUser.id,
          status: 'confirmed',
        }, {
          overrideAccess: true,
        })
      }

      // Try to increase quantity beyond capacity (should fail)
      await expect(
        caller.bookings.createBookings({
          timeslotId: testTimeslot.id,
          quantity: 1, // This would exceed capacity
        })
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'event-types',
        where: { id: { equals: smallEventType.id } },
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: otherUser.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.setMyBookingQuantityForTimeslot', () => {
    it('should increase quantity from 1 to 3', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create 1 initial confirmed booking
      const initialBooking = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })

      expect(initialBooking.length).toBe(1)

      // Increase quantity to 3
      const result = await caller.bookings.setMyBookingQuantityForTimeslot({
        timeslotId: testTimeslot.id,
        desiredQuantity: 3,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(3)
      
      // All bookings should be confirmed
      result.forEach((booking) => {
        // Handle both ID and populated object cases
        const timeslotRef = typeof booking.timeslot === 'object' && booking.timeslot !== null
          ? (booking.timeslot as any).id
          : booking.timeslot
        const userId = typeof booking.user === 'object' && booking.user !== null
          ? (booking.user as any).id
          : booking.user
        
        expect(timeslotRef).toBe(testTimeslot.id)
        expect(userId).toBe(user.id)
        expect(booking.status).toBe('confirmed')
      })

      // Verify we have exactly 3 confirmed bookings
      const allBookings = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })

      expect(allBookings.docs.length).toBe(3)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should decrease quantity from 3 to 1 (newest-first)', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(17, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(18, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create 3 confirmed bookings with delays to ensure different createdAt timestamps
      const _booking1 = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
      
      const _booking2 = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const _booking3 = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
      })

      // Verify we have 3 bookings
      const beforeDecrease = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(beforeDecrease.docs.length).toBe(3)

      // Decrease quantity to 1
      const result = await caller.bookings.setMyBookingQuantityForTimeslot({
        timeslotId: testTimeslot.id,
        desiredQuantity: 1,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe('confirmed')

      // Verify we have exactly 1 confirmed booking remaining
      const afterDecrease = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(afterDecrease.docs.length).toBe(1)

      // Verify 2 bookings were cancelled (newest-first policy)
      const cancelledBookings = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'cancelled' },
        },
        overrideAccess: true,
      })
      expect(cancelledBookings.docs.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should do nothing when desired quantity equals current quantity (no-op)', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(19, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(20, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create 2 confirmed bookings
      await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
      })

      // Get bookings before no-op
      const beforeNoOp = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      const beforeIds = beforeNoOp.docs.map(b => Number(b.id)).sort((a, b) => a - b)

      // Set quantity to same value (2)
      const result = await caller.bookings.setMyBookingQuantityForTimeslot({
        timeslotId: testTimeslot.id,
        desiredQuantity: 2,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(2)

      // Verify no bookings were changed (same IDs)
      const afterNoOp = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      const afterIds = afterNoOp.docs.map(b => Number(b.id)).sort((a, b) => a - b)
      
      expect(afterIds).toEqual(beforeIds)
      expect(afterNoOp.docs.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('should prevent increasing quantity beyond remaining capacity', async () => {
      // Create a fresh lesson with limited capacity
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(20, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(21, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      const caller = await createCaller()

      // Create 2 confirmed bookings for the test user
      await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
      })

      // Create another user to fill remaining capacity
      const otherUser = (await payload.create({
        collection: 'users',
        data: {
          name: 'Other Test User',
          email: `other-test-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      // Fill remaining capacity with other user's bookings
      const remainingCapacity = eventType.places - 2
      for (let i = 0; i < remainingCapacity; i++) {
        await createWithTenant('bookings', {
          timeslot: testTimeslot.id,
          user: otherUser.id,
          status: 'confirmed',
        }, {
          overrideAccess: true,
        })
      }

      // Try to increase quantity beyond capacity (should fail)
      // User has 2 bookings, lesson has 0 remaining capacity
      // Trying to increase to eventType.places + 1 should fail
      await expect(
        caller.bookings.setMyBookingQuantityForTimeslot({
          timeslotId: testTimeslot.id,
          desiredQuantity: 3, // Would require 1 more slot, but capacity is 0
        })
      ).rejects.toThrow()

      // Verify test user's bookings count unchanged (still 2)
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(bookings.docs.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: otherUser.id } },
      })
    }, TEST_TIMEOUT)

    it('should prevent user from modifying another user\'s bookings', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(21, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(22, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        {
          draft: false,
          overrideAccess: true,
        }
      ))

      // Create another user
      const otherUser = (await payload.create({
        collection: 'users',
        data: {
          name: 'Other User',
          email: `other-user-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      // Create bookings for other user using overrideAccess
      await createWithTenant('bookings', {
        timeslot: testTimeslot.id,
        user: otherUser.id,
        status: 'confirmed',
      }, {
        overrideAccess: true,
      })

      const caller = await createCaller()

      // Try to modify other user's bookings (should fail or only affect current user's bookings)
      // Since we're authenticated as `user`, we should only be able to modify our own bookings
      // If other user has bookings, we should not be able to affect them
      const result = await caller.bookings.setMyBookingQuantityForTimeslot({
        timeslotId: testTimeslot.id,
        desiredQuantity: 1,
      })

      // Should only affect current user's bookings (which are 0, so it should create 1)
      expect(result).toBeDefined()
      expect(result.length).toBe(1) // Creates 1 booking for current user
      
      // Verify the result contains only the current user's bookings
      result.forEach((booking) => {
        const bookingUserId = typeof booking.user === 'object' && booking.user !== null
          ? booking.user.id
          : booking.user
        expect(bookingUserId).toBe(user.id)
      })

      // Verify other user's booking is unchanged
      const otherUserBookings = await payload.find({
        collection: 'bookings',
        where: {
          timeslot: { equals: testTimeslot.id },
          user: { equals: otherUser.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(otherUserBookings.docs.length).toBe(1)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: otherUser.id } },
        })
      } catch (_e) {
        // Ignore cleanup errors
      }
    }, TEST_TIMEOUT)
  })

  describe('pending and confirmed bookings (checkout return edge case)', () => {
    it('setMyBookingQuantityForTimeslot only considers confirmed; pending bookings remain untouched', async () => {
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(10, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(11, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))

      const caller = await createCaller()

      // 2 confirmed
      await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
      })
      // 3 pending (e.g. user added more and went to checkout, then left)
      const pendingBookings = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 3,
        status: 'pending',
      })
      expect(pendingBookings.length).toBe(3)

      // setMyBookingQuantityForTimeslot(2) should be a no-op: 2 confirmed, desired 2. Pending must not be cancelled.
      const result = await caller.bookings.setMyBookingQuantityForTimeslot({
        timeslotId: testTimeslot.id,
        desiredQuantity: 2,
      })
      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      result.forEach((b) => expect(b.status).toBe('confirmed'))

      const allBookings = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      const confirmed = allBookings.filter((b) => b.status === 'confirmed')
      const pending = allBookings.filter((b) => b.status === 'pending')
      expect(confirmed.length).toBe(2)
      expect(pending.length).toBe(3)

      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)

    it('cancelBooking cancels pending bookings; getUserBookingsForTimeslot then returns only confirmed', async () => {
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 2)
      startTime.setHours(9, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(10, 0, 0, 0)

      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))

      const caller = await createCaller()

      await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
      })
      const pendingBookings = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 2,
        status: 'pending',
      })

      for (const booking of pendingBookings) {
        await caller.bookings.cancelBooking({ id: booking.id })
      }

      const after = await caller.bookings.getUserBookingsForTimeslot({
        timeslotId: testTimeslot.id,
      })
      const confirmed = after.filter((b) => b.status === 'confirmed')
      const pending = after.filter((b) => b.status === 'pending')
      expect(confirmed.length).toBe(2)
      expect(pending.length).toBe(0)

      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
      })
      await payload.delete({
        collection: 'timeslots',
        where: { id: { equals: testTimeslot.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('Subscription booking and getSubscriptionForTimeslot', () => {
    it('getSubscriptionForTimeslot returns needsCustomerPortal and upgradeOptions', async () => {
      const hasPlans = payload.config?.collections?.some((c: any) => c.slug === 'plans')
      const hasSubs = payload.config?.collections?.some((c: any) => c.slug === 'subscriptions')
      if (!hasPlans || !hasSubs) {
        return
      }
      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: '2 per week',
          status: 'active',
          tenant: testTenant.id,
          sessionsInformation: { sessions: 2, interval: 'week', intervalCount: 1 },
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: subscriptionConnectAccountId,
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: {
          paymentMethods: { allowedPlans: [plan.id] },
        },
        overrideAccess: true,
      })
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const sub = await payload.create({
        collection: 'subscriptions',
        data: {
          user: user.id,
          plan: plan.id,
          status: 'active',
          tenant: testTenant.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        overrideAccess: true,
      })
      const caller = await createCaller()
      const result = await caller.subscriptions.getSubscriptionForTimeslot({ timeslotId: lesson.id })
      expect(result.subscription).toBeDefined()
      expect(result.subscription?.id).toBe(sub.id)
      expect(result.needsCustomerPortal).toBe(false)
      expect(Array.isArray(result.upgradeOptions)).toBe(true)
      await payload.update({
        collection: 'subscriptions',
        id: sub.id,
        data: { status: 'past_due' },
        overrideAccess: true,
      })
      const resultPastDue = await caller.subscriptions.getSubscriptionForTimeslot({ timeslotId: lesson.id })
      expect(resultPastDue.needsCustomerPortal).toBe(true)
      await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
      await payload.delete({ collection: 'plans', id: plan.id, overrideAccess: true })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: {} },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: { stripeConnectOnboardingStatus: 'not_connected', stripeConnectAccountId: null },
        overrideAccess: true,
      })
    }, TEST_TIMEOUT)

    it('createBookings with subscriptionId creates bookings with paymentMethodUsed and subscriptionIdUsed', async () => {
      const hasPlans = payload.config?.collections?.some((c: any) => c.slug === 'plans')
      const hasSubs = payload.config?.collections?.some((c: any) => c.slug === 'subscriptions')
      if (!hasPlans || !hasSubs) return
      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: '2 per week',
          status: 'active',
          tenant: testTenant.id,
          sessionsInformation: { sessions: 2, interval: 'week', intervalCount: 1 },
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: subscriptionConnectAccountId,
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedPlans: [plan.id] } },
        overrideAccess: true,
      })
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const sub = await payload.create({
        collection: 'subscriptions',
        data: {
          user: user.id,
          plan: plan.id,
          status: 'active',
          tenant: testTenant.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        overrideAccess: true,
      })
      const startTime = new Date()
      startTime.setHours(20, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(21, 0, 0, 0)
      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))
      const caller = await createCaller()
      const created = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
        subscriptionId: Number(sub.id),
      })
      expect(created.length).toBe(1)
      const booking = await payload.findByID({
        collection: 'bookings',
        id: created[0]!.id,
        depth: 0,
      }) as any
      expect(booking.paymentMethodUsed).toBe('subscription')
      expect(booking.subscriptionIdUsed).toBe(sub.id)
      await payload.delete({ collection: 'bookings', where: { id: { equals: created[0]!.id } }, overrideAccess: true })
      await payload.delete({ collection: 'timeslots', where: { id: { equals: testTimeslot.id } }, overrideAccess: true })
      await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
      await payload.delete({ collection: 'plans', id: plan.id, overrideAccess: true })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: {} },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: { stripeConnectOnboardingStatus: 'not_connected', stripeConnectAccountId: null },
        overrideAccess: true,
      })
    }, TEST_TIMEOUT)

    it('createBookings with subscriptionId + pendingBookingIds confirms pending bookings (use my membership)', async () => {
      const hasPlans = payload.config?.collections?.some((c: any) => c.slug === 'plans')
      const hasSubs = payload.config?.collections?.some((c: any) => c.slug === 'subscriptions')
      if (!hasPlans || !hasSubs) return
      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: '2 per week',
          status: 'active',
          tenant: testTenant.id,
          sessionsInformation: { sessions: 2, interval: 'week', intervalCount: 1 },
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: subscriptionConnectAccountId,
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedPlans: [plan.id] } },
        overrideAccess: true,
      })
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const sub = await payload.create({
        collection: 'subscriptions',
        data: {
          user: user.id,
          plan: plan.id,
          status: 'active',
          tenant: testTenant.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        overrideAccess: true,
      })
      const startTime = new Date()
      startTime.setHours(20, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(21, 0, 0, 0)
      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))
      const caller = await createCaller()
      const pendingBookings = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
        status: 'pending',
      })
      expect(pendingBookings.length).toBe(1)
      pendingBookings.forEach((b) => expect(b.status).toBe('pending'))

      const confirmed = await caller.bookings.createBookings({
        timeslotId: testTimeslot.id,
        quantity: 1,
        subscriptionId: Number(sub.id),
        pendingBookingIds: pendingBookings.map((b) => Number(b.id)),
      })
      expect(confirmed.length).toBe(1)
      const allForTimeslot = await payload.find({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })
      expect(allForTimeslot.totalDocs).toBe(1)
      for (const b of confirmed) {
        expect(b.status).toBe('confirmed')
        const doc = await payload.findByID({
          collection: 'bookings',
          id: b.id,
          depth: 0,
        }) as any
        expect(doc.status).toBe('confirmed')
        expect(doc.paymentMethodUsed).toBe('subscription')
        expect(doc.subscriptionIdUsed).toBe(sub.id)
      }
      const hasTransactions = payload.config?.collections?.some((c: any) => c.slug === 'transactions')
      if (hasTransactions) {
        for (const b of confirmed) {
          const txs = await payload.find({
            collection: 'transactions',
            where: { booking: { equals: b.id } },
            limit: 1,
            overrideAccess: true,
          })
          expect(txs.totalDocs).toBe(1)
        }
      }
      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'timeslots', where: { id: { equals: testTimeslot.id } }, overrideAccess: true })
      await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
      await payload.delete({ collection: 'plans', id: plan.id, overrideAccess: true })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: {} },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: { stripeConnectOnboardingStatus: 'not_connected', stripeConnectAccountId: null },
        overrideAccess: true,
      })
    }, TEST_TIMEOUT)

    it('createBookings with subscriptionId throws when subscription is past_due', async () => {
      const hasPlans = payload.config?.collections?.some((c: any) => c.slug === 'plans')
      const hasSubs = payload.config?.collections?.some((c: any) => c.slug === 'subscriptions')
      if (!hasPlans || !hasSubs) return
      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: '2 per week',
          status: 'active',
          tenant: testTenant.id,
          sessionsInformation: { sessions: 2, interval: 'week', intervalCount: 1 },
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: subscriptionConnectAccountId,
        },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedPlans: [plan.id] } },
        overrideAccess: true,
      })
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const sub = await payload.create({
        collection: 'subscriptions',
        data: {
          user: user.id,
          plan: plan.id,
          status: 'past_due',
          tenant: testTenant.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        overrideAccess: true,
      })
      const startTime = new Date()
      startTime.setHours(21, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(22, 0, 0, 0)
      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))
      const caller = await createCaller()
      await expect(
        caller.bookings.createBookings({
          timeslotId: testTimeslot.id,
          quantity: 1,
          subscriptionId: Number(sub.id),
        })
      ).rejects.toThrow(/past due|portal/)
      await payload.delete({ collection: 'timeslots', where: { id: { equals: testTimeslot.id } }, overrideAccess: true })
      await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
      await payload.delete({ collection: 'plans', id: plan.id, overrideAccess: true })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: {} },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: { stripeConnectOnboardingStatus: 'not_connected', stripeConnectAccountId: null },
        overrideAccess: true,
      })
    }, TEST_TIMEOUT)
  })

  describe('Schedule single-slot membership shortcut', () => {
    it('books directly when lesson is single-slot and user has an active subscription', async () => {
      const hasPlans = payload.config?.collections?.some((c: any) => c.slug === 'plans')
      const hasSubs = payload.config?.collections?.some((c: any) => c.slug === 'subscriptions')
      if (!hasPlans || !hasSubs) return

      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: `Schedule Shortcut Plan ${Date.now()}`,
          status: 'active',
          tenant: testTenant.id,
          sessionsInformation: {
            sessions: 2,
            interval: 'week',
            intervalCount: 1,
            // Explicitly single-slot for memberships
            allowMultipleBookingsPerTimeslot: false,
          },
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: scheduleShortcutAccountId,
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedPlans: [plan.id] } },
        overrideAccess: true,
      })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const sub = await payload.create({
        collection: 'subscriptions',
        data: {
          user: user.id,
          plan: plan.id,
          status: 'active',
          tenant: testTenant.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        overrideAccess: true,
      })

      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(9, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(10, 0, 0, 0)
      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))

      const caller = await createCaller()
      const result = await (caller as any).bookings.bookSingleSlotTimeslotOrRedirect({
        timeslotId: testTimeslot.id,
      })

      expect(result).toBeDefined()
      expect(result.redirectUrl ?? null).toBe(null)

      // Verify booking exists and is confirmed with subscription markers
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { timeslot: { equals: testTimeslot.id } },
            { user: { equals: user.id } },
            { status: { equals: 'confirmed' } },
          ],
        },
        depth: 0,
        overrideAccess: true,
      })
      expect(bookings.totalDocs).toBe(1)
      const doc: any = bookings.docs[0]
      expect(doc.paymentMethodUsed).toBe('subscription')
      expect(doc.subscriptionIdUsed).toBe(sub.id)

      await payload.delete({
        collection: 'bookings',
        where: { timeslot: { equals: testTimeslot.id } },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'timeslots', where: { id: { equals: testTimeslot.id } }, overrideAccess: true })
      await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
      await payload.delete({ collection: 'plans', id: plan.id, overrideAccess: true })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: {} },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: { stripeConnectOnboardingStatus: 'not_connected', stripeConnectAccountId: null },
        overrideAccess: true,
      })
    }, TEST_TIMEOUT)

    it('redirects to booking page when lesson is single-slot but membership is past due', async () => {
      const hasPlans = payload.config?.collections?.some((c: any) => c.slug === 'plans')
      const hasSubs = payload.config?.collections?.some((c: any) => c.slug === 'subscriptions')
      if (!hasPlans || !hasSubs) return

      const plan = await payload.create({
        collection: 'plans',
        data: {
          name: `Schedule Shortcut Past Due Plan ${Date.now()}`,
          status: 'active',
          tenant: testTenant.id,
          sessionsInformation: {
            sessions: 2,
            interval: 'week',
            intervalCount: 1,
            allowMultipleBookingsPerTimeslot: false,
          },
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: scheduleShortcutPastDueAccountId,
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: { allowedPlans: [plan.id] } },
        overrideAccess: true,
      })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const sub = await payload.create({
        collection: 'subscriptions',
        data: {
          user: user.id,
          plan: plan.id,
          status: 'past_due',
          tenant: testTenant.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        overrideAccess: true,
      })

      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(11, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(12, 0, 0, 0)
      const testTimeslot = (await createWithTenant<Timeslot>(
        'timeslots',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventType: eventType.id,
          location: 'Test',
          active: true,
          lockOutTime: 0,
        },
        { draft: false, overrideAccess: true }
      ))

      const caller = await createCaller()
      const result = await (caller as any).bookings.bookSingleSlotTimeslotOrRedirect({
        timeslotId: testTimeslot.id,
      })

      expect(result).toBeDefined()
      // Past-due subscriptions are not directly usable, so the shortcut falls back to
      // the booking page where the membership UI can surface the customer portal flow.
      expect(result.redirectUrl).toBe(`/bookings/${testTimeslot.id}`)

      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { timeslot: { equals: testTimeslot.id } },
            { user: { equals: user.id } },
            { status: { equals: 'confirmed' } },
          ],
        },
        depth: 0,
        overrideAccess: true,
      })
      expect(bookings.totalDocs).toBe(0)

      await payload.delete({ collection: 'timeslots', where: { id: { equals: testTimeslot.id } }, overrideAccess: true })
      await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true })
      await payload.delete({ collection: 'plans', id: plan.id, overrideAccess: true })
      await payload.update({
        collection: 'event-types',
        id: eventType.id,
        data: { paymentMethods: {} },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'tenants',
        id: testTenant.id,
        data: { stripeConnectOnboardingStatus: 'not_connected', stripeConnectAccountId: null },
        overrideAccess: true,
      })
    }, TEST_TIMEOUT)
  })
})

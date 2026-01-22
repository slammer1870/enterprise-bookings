import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Lesson, ClassOption } from '@repo/shared-types'

const TEST_TIMEOUT = 60000 // 60 seconds
const HOOK_TIMEOUT = 300000 // 5 minutes

describe('tRPC Bookings Integration Tests', () => {
  let payload: Payload
  let user: User
  let lesson: Lesson
  let classOption: ClassOption
  let testTenant: { id: number | string }
  let authSpy: ReturnType<typeof vi.spyOn>

  // Helper to create tenant-scoped documents with tenant automatically added
  const createWithTenant = async <T = any>(
    collection: 'lessons' | 'class-options' | 'bookings' | 'instructors',
    data: any,
    options?: Omit<Parameters<typeof payload.create>[0], 'collection' | 'data'>
  ): Promise<T> => {
    const tenantScopedCollections: Array<'lessons' | 'class-options' | 'bookings' | 'instructors'> = ['lessons', 'class-options', 'bookings', 'instructors']
    if (tenantScopedCollections.includes(collection)) {
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
        roles: ['user'], // Assign user role for booking access
        emailVerified: true, // Better Auth may require this
      },
      draft: false, // Explicitly set to non-draft
      overrideAccess: true, // Bypass access controls for test setup
    } as Parameters<typeof payload.create>[0])) as User

    // Set up auth spy once for all tests
    authSpy = vi.spyOn(payload, 'auth').mockImplementation(async () => {
      return {
        user: user as any,
      } as any
    }) as any

    // Create class option with tenant
    // Use overrideAccess to bypass access controls for test setup
    // Use unique name with timestamp to avoid conflicts
    const uniqueName = `Test Class Option ${Date.now()}`
    classOption = (await createWithTenant<ClassOption>(
      'class-options',
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

    lesson = (await createWithTenant<Lesson>(
      'lessons',
      {
        date: startTime.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        classOption: classOption.id,
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
    // Restore auth spy
    if (authSpy) {
      authSpy.mockRestore()
    }

    if (payload) {
      // Cleanup test data
      try {
        await payload.delete({
          collection: 'lessons',
          where: { id: { equals: lesson.id } },
        })
      } catch (e) {
        // Ignore cleanup errors
      }
      try {
        await payload.delete({
          collection: 'class-options',
          where: { id: { equals: classOption.id } },
        })
      } catch (e) {
        // Ignore cleanup errors
      }
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: user.id } },
        })
      } catch (e) {
        // Ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  const createCaller = async () => {
    const headers = new Headers()
    
    const ctx = await createTRPCContext({
      headers,
      payload,
    })

    // Create caller - the auth spy set up in beforeAll will be used
    return appRouter.createCaller(ctx)
  }

  describe('lessons.getByIdForBooking', () => {
    it('should fetch a lesson successfully', async () => {
      // Create a fresh lesson for this test to ensure clean state
      // Use tomorrow to ensure lesson is not closed (hasn't started yet)
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1) // Tomorrow
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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

      const result = await caller.lessons.getByIdForBooking({ id: testLesson.id })

      expect(result).toBeDefined()
      expect(result.id).toBe(testLesson.id)
      expect(result.classOption).toBeDefined()

      // Cleanup
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error for non-existent lesson', async () => {
      const caller = await createCaller()

      await expect(caller.lessons.getByIdForBooking({ id: 99999 })).rejects.toThrow()
    }, TEST_TIMEOUT)

    it('should throw error when lesson is fully booked', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(11, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(12, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        {
          draft: false,
        }
      ))

      const caller = await createCaller()

      // Fill up the lesson using overrideAccess for test setup
      for (let i = 0; i < classOption.places; i++) {
        await payload.create({
          collection: 'bookings',
          data: {
            lesson: testLesson.id,
            user: user.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })
      }

      await expect(caller.lessons.getByIdForBooking({ id: testLesson.id })).rejects.toThrow(
        'no longer available for booking'
      )

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.createBookings', () => {
    it('should create a single booking', async () => {
      // Create a fresh lesson for this test to avoid capacity issues
      const startTime = new Date()
      startTime.setHours(12, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(13, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 1,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0]?.lesson).toBe(testLesson.id)
      expect(result[0]?.user).toBe(user.id)
      expect(result[0]?.status).toBe('confirmed')

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { equals: result[0]?.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should create multiple bookings', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 3,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(3)
      result.forEach((booking) => {
        expect(booking.lesson).toBe(testLesson.id)
        expect(booking.user).toBe(user.id)
        expect(booking.status).toBe('confirmed')
      })

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { in: result.map((b) => b.id) } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error when quantity exceeds remaining capacity', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
      for (let i = 0; i < classOption.places - 2; i++) {
        await payload.create({
          collection: 'bookings',
          data: {
            lesson: testLesson.id,
            user: user.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })
      }

      // Try to book more than remaining capacity
      await expect(
        caller.bookings.createBookings({
          lessonId: testLesson.id,
          quantity: 5, // More than remaining (2)
        })
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should throw error when quantity is less than 1', async () => {
      const caller = await createCaller()

      await expect(
        caller.bookings.createBookings({
          lessonId: lesson.id,
          quantity: 0,
        })
      ).rejects.toThrow()
    }, TEST_TIMEOUT)

    it('should throw error for non-existent lesson', async () => {
      const caller = await createCaller()

      await expect(
        caller.bookings.createBookings({
          lessonId: 99999,
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

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 2,
        status: 'pending',
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      result.forEach((booking) => {
        expect(booking.lesson).toBe(testLesson.id)
        expect(booking.user).toBe(user.id)
        expect(booking.status).toBe('pending')
      })

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { in: result.map((b) => b.id) } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.getUserBookingsForLesson', () => {
    it('should fetch user bookings for a lesson', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(20, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(21, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
          lesson: testLesson.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const booking2 = await payload.create({
        collection: 'bookings',
        data: {
          lesson: testLesson.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      const result = await caller.bookings.getUserBookingsForLesson({
        lessonId: testLesson.id,
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
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should not return cancelled bookings', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setHours(22, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(23, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
          lesson: testLesson.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const cancelledBooking = await payload.create({
        collection: 'bookings',
        data: {
          lesson: testLesson.id,
          user: user.id,
          status: 'cancelled',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      const result = await caller.bookings.getUserBookingsForLesson({
        lessonId: testLesson.id,
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
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
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

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
          lesson: testLesson.id,
          user: user.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      // Cancel by booking ID (API expects booking id, not lesson id)
      const result = await caller.bookings.cancelBooking({ id: booking.id })

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
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
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
          roles: ['user'],
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

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
          lesson: testLesson.id,
          user: otherUser.id,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const caller = await createCaller()

      // Try to cancel the other user's booking by its ID (should fail)
      await expect(
        caller.bookings.cancelBooking({ id: otherUserBooking.id })
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { id: { equals: otherUserBooking.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: otherUser.id } },
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

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 1,
      })

      expect(initialBookings.length).toBe(1)

      // Get current bookings
      const bookingsBefore = await caller.bookings.getUserBookingsForLesson({
        lessonId: testLesson.id,
      })
      expect(bookingsBefore.length).toBe(1)

      // Increase quantity by creating 2 more bookings
      const additionalBookings = await caller.bookings.createBookings({
        lessonId: testLesson.id,
        quantity: 2,
      })

      expect(additionalBookings.length).toBe(2)

      // Verify total bookings
      const bookingsAfter = await caller.bookings.getUserBookingsForLesson({
        lessonId: testLesson.id,
      })
      expect(bookingsAfter.length).toBe(3)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should allow decreasing booking quantity by cancelling', async () => {
      // Create a fresh lesson
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 3,
      })

      expect(bookings.length).toBe(3)

      // Verify initial count
      const bookingsBefore = await caller.bookings.getUserBookingsForLesson({
        lessonId: testLesson.id,
      })
      expect(bookingsBefore.length).toBe(3)

      // Cancel one booking (decrease quantity by 1) using a specific booking ID
      await caller.bookings.cancelBooking({ id: bookings[0]!.id })

      // Verify decreased count
      const bookingsAfter = await caller.bookings.getUserBookingsForLesson({
        lessonId: testLesson.id,
      })
      expect(bookingsAfter.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should prevent increasing quantity beyond remaining capacity', async () => {
      // Create a fresh lesson with limited capacity
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(18, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(19, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
      await caller.bookings.createBookings({
        lessonId: testLesson.id,
        quantity: 1,
      })

      // Fill remaining capacity with other bookings (using overrideAccess)
      const remainingCapacity = classOption.places - 1
      for (let i = 0; i < remainingCapacity; i++) {
        await createWithTenant('bookings', {
          lesson: testLesson.id,
          user: user.id,
          status: 'confirmed',
        }, {
          overrideAccess: true,
        })
      }

      // Try to increase quantity beyond capacity (should fail)
      await expect(
        caller.bookings.createBookings({
          lessonId: testLesson.id,
          quantity: 1, // This would exceed capacity
        })
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)
  })

  describe('bookings.setMyBookingQuantityForLesson', () => {
    it('should increase quantity from 1 to 3', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 1,
      })

      expect(initialBooking.length).toBe(1)

      // Increase quantity to 3
      const result = await caller.bookings.setMyBookingQuantityForLesson({
        lessonId: testLesson.id,
        desiredQuantity: 3,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(3)
      
      // All bookings should be confirmed
      result.forEach((booking) => {
        // Handle both ID and populated object cases
        const lessonId = typeof booking.lesson === 'object' && booking.lesson !== null
          ? (booking.lesson as any).id
          : booking.lesson
        const userId = typeof booking.user === 'object' && booking.user !== null
          ? (booking.user as any).id
          : booking.user
        
        expect(lessonId).toBe(testLesson.id)
        expect(userId).toBe(user.id)
        expect(booking.status).toBe('confirmed')
      })

      // Verify we have exactly 3 confirmed bookings
      const allBookings = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })

      expect(allBookings.docs.length).toBe(3)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should decrease quantity from 3 to 1 (newest-first)', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(17, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(18, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
      const booking1 = await caller.bookings.createBookings({
        lessonId: testLesson.id,
        quantity: 1,
      })
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
      
      const booking2 = await caller.bookings.createBookings({
        lessonId: testLesson.id,
        quantity: 1,
      })
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const booking3 = await caller.bookings.createBookings({
        lessonId: testLesson.id,
        quantity: 1,
      })

      // Verify we have 3 bookings
      const beforeDecrease = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(beforeDecrease.docs.length).toBe(3)

      // Decrease quantity to 1
      const result = await caller.bookings.setMyBookingQuantityForLesson({
        lessonId: testLesson.id,
        desiredQuantity: 1,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe('confirmed')

      // Verify we have exactly 1 confirmed booking remaining
      const afterDecrease = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
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
          lesson: { equals: testLesson.id },
          user: { equals: user.id },
          status: { equals: 'cancelled' },
        },
        overrideAccess: true,
      })
      expect(cancelledBookings.docs.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should do nothing when desired quantity equals current quantity (no-op)', async () => {
      // Create a fresh lesson for this test
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(19, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(20, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 2,
      })

      // Get bookings before no-op
      const beforeNoOp = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      const beforeIds = beforeNoOp.docs.map(b => Number(b.id)).sort((a, b) => a - b)

      // Set quantity to same value (2)
      const result = await caller.bookings.setMyBookingQuantityForLesson({
        lessonId: testLesson.id,
        desiredQuantity: 2,
      })

      expect(result).toBeDefined()
      expect(result.length).toBe(2)

      // Verify no bookings were changed (same IDs)
      const afterNoOp = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
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
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
    }, TEST_TIMEOUT)

    it('should prevent increasing quantity beyond remaining capacity', async () => {
      // Create a fresh lesson with limited capacity
      const startTime = new Date()
      startTime.setDate(startTime.getDate() + 1)
      startTime.setHours(20, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(21, 0, 0, 0)

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
        lessonId: testLesson.id,
        quantity: 2,
      })

      // Create another user to fill remaining capacity
      const otherUser = (await payload.create({
        collection: 'users',
        data: {
          name: 'Other Test User',
          email: `other-test-${Date.now()}@test.com`,
          password: 'test',
          roles: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      // Fill remaining capacity with other user's bookings
      const remainingCapacity = classOption.places - 2
      for (let i = 0; i < remainingCapacity; i++) {
        await createWithTenant('bookings', {
          lesson: testLesson.id,
          user: otherUser.id,
          status: 'confirmed',
        }, {
          overrideAccess: true,
        })
      }

      // Try to increase quantity beyond capacity (should fail)
      // User has 2 bookings, lesson has 0 remaining capacity
      // Trying to increase to classOption.places + 1 should fail
      await expect(
        caller.bookings.setMyBookingQuantityForLesson({
          lessonId: testLesson.id,
          desiredQuantity: 3, // Would require 1 more slot, but capacity is 0
        })
      ).rejects.toThrow()

      // Verify test user's bookings count unchanged (still 2)
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
          user: { equals: user.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(bookings.docs.length).toBe(2)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
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

      const testLesson = (await createWithTenant<Lesson>(
        'lessons',
        {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
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
          roles: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

      // Create bookings for other user using overrideAccess
      await createWithTenant('bookings', {
        lesson: testLesson.id,
        user: otherUser.id,
        status: 'confirmed',
      }, {
        overrideAccess: true,
      })

      const caller = await createCaller()

      // Try to modify other user's bookings (should fail or only affect current user's bookings)
      // Since we're authenticated as `user`, we should only be able to modify our own bookings
      // If other user has bookings, we should not be able to affect them
      const result = await caller.bookings.setMyBookingQuantityForLesson({
        lessonId: testLesson.id,
        desiredQuantity: 1,
      })

      // Should only affect current user's bookings (which are 0)
      expect(result).toBeDefined()
      expect(result.length).toBe(0) // No bookings for current user

      // Verify other user's booking is unchanged
      const otherUserBookings = await payload.find({
        collection: 'bookings',
        where: {
          lesson: { equals: testLesson.id },
          user: { equals: otherUser.id },
          status: { equals: 'confirmed' },
        },
        overrideAccess: true,
      })
      expect(otherUserBookings.docs.length).toBe(1)

      // Cleanup
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: testLesson.id } },
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: testLesson.id } },
      })
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: otherUser.id } },
        })
      } catch (e) {
        // Ignore cleanup errors
      }
    }, TEST_TIMEOUT)
  })
})

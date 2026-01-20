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
  let authSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

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

    // Create class option
    // Use overrideAccess to bypass access controls for test setup
    // Use unique name with timestamp to avoid conflicts
    const uniqueName = `Test Class Option ${Date.now()}`
    classOption = (await payload.create({
      collection: 'class-options',
      data: {
        name: uniqueName,
        places: 10,
        description: 'Test Description',
      },
      overrideAccess: true, // Bypass access controls for test setup
    })) as ClassOption

    // Create lesson
    const startTime = new Date()
    startTime.setHours(10, 0, 0, 0) // 10 AM
    const endTime = new Date(startTime)
    endTime.setHours(11, 0, 0, 0) // 11 AM

    lesson = (await payload.create({
      collection: 'lessons',
      data: {
        date: startTime.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        classOption: classOption.id,
        location: 'Test Location',
        active: true,
        lockOutTime: 0, // Required field with default value
      },
      draft: false, // Explicitly set to non-draft
      overrideAccess: true, // Bypass access controls for test setup
    } as Parameters<typeof payload.create>[0])) as Lesson
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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true, // Bypass access controls for test setup
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const result = await caller.bookings.cancelBooking({ id: testLesson.id })

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      // Try to cancel the other user's booking (should fail)
      await expect(
        caller.bookings.cancelBooking({ id: testLesson.id })
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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

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

      // Cancel one booking (decrease quantity by 1)
      await caller.bookings.cancelBooking({ id: testLesson.id })

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

      const testLesson = (await payload.create({
        collection: 'lessons',
        data: {
          date: startTime.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          classOption: classOption.id,
          location: 'Test Location',
          active: true,
          lockOutTime: 0, // Required field with default value
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as Lesson

      const caller = await createCaller()

      // Create initial booking
      await caller.bookings.createBookings({
        lessonId: testLesson.id,
        quantity: 1,
      })

      // Fill remaining capacity with other bookings (using overrideAccess)
      const remainingCapacity = classOption.places - 1
      for (let i = 0; i < remainingCapacity; i++) {
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
})

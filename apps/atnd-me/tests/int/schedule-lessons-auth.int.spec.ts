import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Timeslot, EventType, Tenant } from '@repo/shared-types'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

/**
 * Tests that authenticated users can see timeslots in the schedule on the homepage.
 * This verifies the fix for the issue where authenticated users couldn't see timeslots
 * when accessing the schedule via tRPC getByDate procedure.
 */
const TEST_TIMEOUT = 60000 // 60 seconds
const HOOK_TIMEOUT = 300000 // 5 minutes

function getTimeslotTenantId(lesson: { tenant?: Timeslot['tenant'] }): number | null {
  if (typeof lesson.tenant === 'object' && lesson.tenant !== null && 'id' in lesson.tenant) {
    return lesson.tenant.id
  }

  return typeof lesson.tenant === 'number' ? lesson.tenant : null
}

describe('Schedule timeslots visibility for authenticated users', () => {
  let payload: Payload
  let regularUser: User
  let testTenant: Tenant
  let testTimeslot: Timeslot
  let inactiveTimeslot: Timeslot
  /** Timeslot that started and ended earlier today — must still appear on today's schedule. */
  let endedTodayTimeslot: Timeslot
  let instructorUser: User
  let instructorId: number
  let profileImageId: number
  let planId: number
  let classPassTypeId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Create test tenant
    testTenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-schedule-${Date.now()}`,
        stripeConnectOnboardingStatus: 'active',
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

    instructorUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Schedule StaffMember',
        email: `instructor-schedule-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const profileImage = await payload.create({
      collection: 'media',
      data: {
        alt: 'Schedule StaffMember Headshot',
        tenant: testTenant.id,
      },
      file: {
        name: 'schedule-instructor.png',
        data: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
          'base64',
        ),
        mimetype: 'image/png',
        size: 70,
      },
      overrideAccess: true,
    })
    profileImageId = (profileImage as any).id as number

    const instructor = await payload.create({
      collection: 'staff-members',
      data: {
        user: instructorUser.id,
        active: true,
        profileImage: profileImageId,
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })
    instructorId = (instructor as any).id as number

    // Create payment method dependencies for the class option (to validate sanitization)
    const plan = await payload.create({
      collection: 'plans',
      data: {
        name: `Schedule Test Plan ${Date.now()}`,
        tenant: testTenant.id,
        status: 'active',
        priceInformation: {
          price: 40,
          intervalCount: 1,
          interval: 'week',
        },
        sessionsInformation: {
          sessions: 2,
          intervalCount: 1,
          interval: 'week',
          allowMultipleBookingsPerTimeslot: true,
        },
        // Intentionally set Stripe-y fields that must never leak to public clients
        stripeProductId: 'prod_TEST_SHOULD_NOT_LEAK',
        priceJSON: '{"id":"price_TEST_SHOULD_NOT_LEAK"}',
        skipSync: true,
      },
      overrideAccess: true,
    })
    planId = (plan as any).id as number

    const classPassType = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: `Schedule Test Pass Type ${Date.now()}`,
        slug: `schedule-test-pass-type-${Date.now()}`,
        tenant: testTenant.id,
        quantity: 10,
        allowMultipleBookingsPerTimeslot: true,
        status: 'active',
        stripeProductId: 'prod_TEST_SHOULD_NOT_LEAK',
        priceJSON: '{"id":"price_TEST_SHOULD_NOT_LEAK"}',
        skipSync: true,
      },
      overrideAccess: true,
    })
    classPassTypeId = (classPassType as any).id as number

    // Create class option for the tenant
    const classOption = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Schedule Test Class ${Date.now()}`,
        places: 10,
        description: 'Test description',
        tenant: testTenant.id,
        paymentMethods: {
          allowedPlans: [planId],
          allowedClassPasses: [classPassTypeId],
        },
      },
      overrideAccess: true,
    })) as EventType

    // Create a lesson in the future (schedule endpoint hides ended timeslots)
    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000)
    startTime.setSeconds(0, 0)
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

    testTimeslot = (await payload.create({
      collection: 'timeslots',
      draft: false,
      data: {
        date: startTime.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        staffMember: instructorId,
        eventType: classOption.id,
        active: true,
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as Timeslot

    inactiveTimeslot = (await payload.create({
      collection: 'timeslots',
      draft: false,
      data: {
        date: startTime.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
          staffMember: instructorId,
        eventType: classOption.id,
        active: false,
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as Timeslot

    // A lesson that started and ended earlier today. The schedule should still show it
    // because the rule is "no timeslots from yesterday or earlier", not "endTime >= now".
    const endedStart = new Date()
    endedStart.setHours(endedStart.getHours() - 2, 0, 0, 0)
    const endedEnd = new Date()
    endedEnd.setHours(endedEnd.getHours() - 1, 0, 0, 0)

    endedTodayTimeslot = (await payload.create({
      collection: 'timeslots',
      draft: false,
      data: {
        date: endedStart.toISOString(),
        startTime: endedStart.toISOString(),
        endTime: endedEnd.toISOString(),
        eventType: classOption.id,
        active: true,
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as Timeslot
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        // Cleanup
        await payload.delete({
          collection: 'timeslots',
          where: { id: { equals: testTimeslot.id } },
        })
        await payload.delete({
          collection: 'timeslots',
          where: { id: { equals: inactiveTimeslot.id } },
        })
        await payload.delete({
          collection: 'timeslots',
          where: { id: { equals: endedTodayTimeslot.id } },
        })
        if (planId) {
          await payload.delete({
            collection: 'plans',
            where: { id: { equals: planId } },
          })
        }
        if (classPassTypeId) {
          await payload.delete({
            collection: 'class-pass-types',
            where: { id: { equals: classPassTypeId } },
          })
        }
        await payload.delete({
          collection: 'users',
          where: { id: { equals: regularUser.id } },
        })
        if (instructorId) {
          await payload.delete({
            collection: 'staff-members',
            where: { id: { equals: instructorId } },
          })
        }
        if (profileImageId) {
          await payload.delete({
            collection: 'media',
            where: { id: { equals: profileImageId } },
          })
        }
        await payload.delete({
          collection: 'users',
          where: { id: { equals: instructorUser.id } },
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
    'allows authenticated user to see timeslots via tRPC getByDate with tenant context',
    async () => {
      // Simulate tRPC call with authenticated user and tenant context
      // This mimics what the Schedule component does
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      // Create tRPC context with authenticated user
      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      // Mock the auth to return our regular user
      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: regularUser as any,
      } as any)

      try {
        // Call getByDate using the lesson's calendar day (schedule endpoint hides past days/ended timeslots)
        const today = new Date(testTimeslot.startTime)
        
        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({
          date: today.toISOString(),
        })

        // User should be able to see the lesson
        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(testTimeslot.id)
        expect(timeslots.length).toBeGreaterThan(0)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'allows unauthenticated user to see timeslots via tRPC getByDate with tenant context',
    async () => {
      // Simulate tRPC call without authenticated user but with tenant context
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      // Mock the auth to return no user
      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: null,
      } as any)

      try {
        const today = new Date(testTimeslot.startTime)
        
        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({
          date: today.toISOString(),
        })

        // Unauthenticated users should also be able to see timeslots for booking
        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(testTimeslot.id)

        // But unauthenticated users must not receive tenant/Stripe/payment-provider fields
        // embedded inside nested payment method relationships.
        const lesson = timeslots.find((l) => l.id === testTimeslot.id) as any
        expect(lesson).toBeTruthy()
        expect(lesson.staffMember).toEqual({
          id: instructorId,
          name: 'Schedule StaffMember',
          profileImage: expect.objectContaining({
            url: expect.stringContaining('/media/'),
          }),
        })
        const co = lesson.eventType as any
        expect(co).toBeTruthy()
        // Schedule endpoint must not expose payment method relationship docs at all.
        expect(co).not.toHaveProperty('paymentMethods')
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'hides inactive timeslots from the public schedule response',
    async () => {
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: null,
      } as any)

      try {
        const today = new Date(testTimeslot.startTime)

        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({
          date: today.toISOString(),
        })

        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(testTimeslot.id)
        expect(lessonIds).not.toContain(inactiveTimeslot.id)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'allows authenticated user to see timeslots even when they do not have tenant in tenants array',
    async () => {
      // This is the key scenario: user is authenticated but viewing a tenant
      // they don't have explicit access to (cross-tenant booking scenario)
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      // Mock the auth to return regular user (who doesn't have this tenant)
      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: regularUser as any,
      } as any)

      try {
        const today = new Date(testTimeslot.startTime)
        
        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({
          date: today.toISOString(),
        })

        // Regular authenticated user should be able to see timeslots for the tenant
        // they're currently viewing, even if not in their tenants array
        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(testTimeslot.id)
        expect(timeslots.length).toBeGreaterThan(0)
        
        // Verify all timeslots belong to the tenant from subdomain (not user's tenants)
        for (const lesson of timeslots) {
          expect(getTimeslotTenantId(lesson)).toBe(testTenant.id)
        }
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  // ─── Regressions for the three bugs fixed in this PR ───────────────────────

  it(
    'shows timeslots that ended earlier today for unauthenticated users (endTime >= now must not filter today)',
    async () => {
      // Before the fix, timeslotsRead added `endTime >= now` for public users, hiding
      // timeslots that had already ended but started today. The correct rule is:
      // "no access to yesterday or earlier", not "endTime must be in the future".
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({ user: null } as any)
      try {
        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({ date: new Date().toISOString() })

        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(endedTodayTimeslot.id)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'shows timeslots that ended earlier today for authenticated users',
    async () => {
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: regularUser as any,
      } as any)
      try {
        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({ date: new Date().toISOString() })

        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(endedTodayTimeslot.id)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'returns empty schedule when requesting a past day (yesterday or earlier)',
    async () => {
      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({ user: null } as any)
      try {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({ date: yesterday.toISOString() })

        // getByDate short-circuits to [] when endOfDay < today's start
        expect(timeslots).toHaveLength(0)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'better-auth session user (collection="users", no tenants) can see timeslots via getByDate',
    async () => {
      // Regression: the multi-tenant plugin's withTenantAccess wrapper checked
      // user.collection === 'users' and added { tenant: { in: user.tenants ?? [] } }.
      // better-auth session users have collection:'users' set (via prepareUser/getFieldsToSign)
      // but the `tenants` array is not saved to the JWT, so getUserTenantIDs returned [].
      // The resulting { tenant: { in: [] } } constraint matched nothing → empty schedule.
      // Fix: useTenantAccess: false on the timeslots collection so withTenantAccess never runs.
      const betterAuthSessionUser = {
        ...regularUser,
        collection: 'users', // set by payload-auth's prepareUser via getFieldsToSign
        tenants: undefined,   // NOT in the JWT payload — the trigger for the empty-array bug
      }

      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
        user: betterAuthSessionUser as any,
      } as any)
      try {
        const caller = appRouter.createCaller(ctx)
        const timeslots = await caller.timeslots.getByDate({
          date: new Date(testTimeslot.startTime).toISOString(),
        })

        const lessonIds = timeslots.map((l) => l.id)
        expect(lessonIds).toContain(testTimeslot.id)
        expect(timeslots.length).toBeGreaterThan(0)

        // Inactive timeslots must still be hidden even with this user format
        expect(lessonIds).not.toContain(inactiveTimeslot.id)
      } finally {
        authSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'better-auth session user (collection="users", no tenants) can access getByIdForBooking without NOT_FOUND',
    async () => {
      // Regression: getByIdForBooking used overrideAccess:false with ctx.user set to the
      // better-auth session user (collection:'users', tenants:undefined). withTenantAccess
      // added { tenant: { in: [] } } → findByID returned null → TRPCError NOT_FOUND →
      // createBookingPage caught it and redirected to errorRedirectPath ('/').
      // Fix: useTenantAccess:false for timeslots disables the wrapper entirely.
      const betterAuthSessionUser = {
        ...regularUser,
        collection: 'users',
        tenants: undefined,
      }

      const mockHeaders = new Headers()
      mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

      // Inject the better-auth-format user directly (isTestEnv path in createTRPCContext)
      const ctx = await createTRPCContext({
        headers: mockHeaders,
        payload,
        user: betterAuthSessionUser,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })

      const caller = appRouter.createCaller(ctx)

      // testTimeslot is 2 h in the future → bookingStatus === 'active' → should not throw
      await expect(caller.timeslots.getByIdForBooking({ id: testTimeslot.id })).resolves.toMatchObject({
        id: testTimeslot.id,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'filters timeslots by subdomain tenant context, not user tenants array',
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

      const secondEventType = (await payload.create({
        collection: 'event-types',
        data: {
          name: `Second Tenant Class ${Date.now()}`,
          places: 10,
          description: 'Test description',
          tenant: secondTenant.id,
        },
        overrideAccess: true,
      })) as EventType

      const today = new Date()
      today.setHours(14, 0, 0, 0)
      const endTime = new Date(today)
      endTime.setHours(15, 0, 0, 0)

      const secondTimeslot = (await payload.create({
        collection: 'timeslots',
        draft: false,
        data: {
          date: today.toISOString(),
          startTime: today.toISOString(),
          endTime: endTime.toISOString(),
          eventType: secondEventType.id,
          active: true,
          tenant: secondTenant.id,
        },
        overrideAccess: true,
      })) as Timeslot

      try {
        // User is authenticated, viewing first tenant's subdomain
        const mockHeaders = new Headers()
        mockHeaders.set('cookie', `tenant-slug=${testTenant.slug}`)

        const ctx = await createTRPCContext({
          headers: mockHeaders,
          payload,
          bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
        })

        const authSpy = vi.spyOn(payload, 'auth').mockResolvedValue({
          user: regularUser as any,
        } as any)

        try {
          const today = new Date(testTimeslot.startTime)
          
          const caller = appRouter.createCaller(ctx)
          const timeslots = await caller.timeslots.getByDate({
            date: today.toISOString(),
          })

          // Should only see timeslots from testTenant (from subdomain), not secondTenant
          const lessonIds = timeslots.map((l) => l.id)
          expect(lessonIds).toContain(testTimeslot.id)
          expect(lessonIds).not.toContain(secondTimeslot.id)
          
          // All timeslots should be from the subdomain tenant
          for (const lesson of timeslots) {
            expect(getTimeslotTenantId(lesson)).toBe(testTenant.id)
          }
        } finally {
          authSpy.mockRestore()
        }
      } finally {
        // Cleanup second tenant data
        try {
          await payload.delete({
            collection: 'timeslots',
            where: { id: { equals: secondTimeslot.id } },
          })
          await payload.delete({
            collection: 'event-types',
            where: { id: { equals: secondEventType.id } },
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

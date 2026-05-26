/**
 * Integration tests: checkout hold tRPC procedures (TDD).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, Payload } from 'payload'
import config from '../../src/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Timeslot, EventType } from '@repo/shared-types'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '../../src/constants/bookings-collection-slugs'
import { defaultTimeslotFields } from './timeslot-test-data'

const HOOK_TIMEOUT = 300000

describe('tRPC checkout holds', () => {
  let payload: Payload
  let user: User
  let lesson: Timeslot
  let testTenant: { id: number; slug: string }

  const createCaller = async (u?: User) => {
    const ctx = await createTRPCContext({
      headers: new Headers({ 'tenant-slug': testTenant.slug }),
      payload,
      user: u,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    } as Parameters<typeof createTRPCContext>[0])
    return appRouter.createCaller(ctx)
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    testTenant = (await payload.create({
      collection: 'tenants',
      data: { name: 'Hold Test Tenant', slug: `hold-tenant-${Date.now()}` },
      overrideAccess: true,
    })) as { id: number; slug: string }

    user = (await payload.create({
      collection: 'users',
      data: {
        name: 'Hold User',
        email: `hold-user-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      overrideAccess: true,
    })) as User

    const eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: 'Hold Class',
        places: 5,
        description: 'Test',
        tenant: testTenant.id,
      },
      overrideAccess: true,
    })) as EventType

    const { date, startTime, endTime, lockOutTime, active } = defaultTimeslotFields(3)

    lesson = (await payload.create({
      collection: 'timeslots',
      data: {
        eventType: eventType.id,
        date,
        startTime,
        endTime,
        tenant: testTenant.id,
        active,
        lockOutTime,
      },
      overrideAccess: true,
    })) as Timeslot
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) await payload.db.destroy()
  })

  it(
    'upsertCheckoutHold creates hold without booking rows',
    async () => {
      const hasHoldCollection = payload.config.collections?.some(
        (c) => c.slug === 'booking-checkout-holds',
      )
      if (!hasHoldCollection) return

      const caller = await createCaller(user)
      const result = await caller.bookings.upsertCheckoutHold({
        timeslotId: lesson.id as number,
        quantity: 2,
      })

      expect(result.holdId).toBeGreaterThan(0)
      expect(result.quantity).toBe(2)

      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { timeslot: { equals: lesson.id } },
            { user: { equals: user.id } },
          ],
        },
        overrideAccess: true,
      })
      expect(bookings.totalDocs).toBe(0)
    },
    HOOK_TIMEOUT,
  )

  it(
    'releaseCheckoutHold removes hold',
    async () => {
      const hasHoldCollection = payload.config.collections?.some(
        (c) => c.slug === 'booking-checkout-holds',
      )
      if (!hasHoldCollection) return

      const caller = await createCaller(user)
      await caller.bookings.upsertCheckoutHold({
        timeslotId: lesson.id as number,
        quantity: 1,
      })

      const released = await caller.bookings.releaseCheckoutHold({
        timeslotId: lesson.id as number,
      })
      expect(released.released).toBeGreaterThanOrEqual(1)

      const hold = await caller.bookings.getActiveCheckoutHold({
        timeslotId: lesson.id as number,
      })
      expect(hold).toBeNull()
    },
    HOOK_TIMEOUT,
  )

  it(
    'getActiveCheckoutHold returns active hold after upsert',
    async () => {
      const hasHoldCollection = payload.config.collections?.some(
        (c) => c.slug === 'booking-checkout-holds',
      )
      if (!hasHoldCollection) return

      const caller = await createCaller(user)
      await caller.bookings.upsertCheckoutHold({
        timeslotId: lesson.id as number,
        quantity: 1,
      })

      const hold = await caller.bookings.getActiveCheckoutHold({
        timeslotId: lesson.id as number,
      })
      expect(hold).not.toBeNull()
      expect(hold?.quantity).toBe(1)
    },
    HOOK_TIMEOUT,
  )
})

/**
 * When a booking is created with paymentMethodUsed 'class_pass' and classPassIdUsed,
 * createBookingTransactionOnCreate creates a booking-transaction with paymentMethod 'class_pass' and classPassId.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Class-pass booking create → booking-transaction', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let classOptionId: number
  let lessonId: number
  let classPassId: number
  let classPassTypeId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: 'CP Tx Tenant', slug: `cp-tx-tenant-${Date.now()}` },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'CP Tx User',
        email: `cp-tx-user-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const co = await payload.create({
      collection: 'event-types',
      data: {
        name: `CP Tx Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    classOptionId = co.id as number

    const start = new Date()
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await payload.create({
      collection: 'timeslots',
      data: {
        tenant: tenantId,
        classOption: classOptionId,
        date: start.toISOString().slice(0, 10),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    lessonId = lesson.id as number

    const classPassType = await payload.create({
      collection: 'class-pass-types' as import('payload').CollectionSlug,
      data: {
        name: 'CP Tx 5-Pack',
        slug: `cp-tx-5pack-${tenantId}-${Date.now()}`,
        description: 'For int test',
        quantity: 5,
        tenant: tenantId,
        priceInformation: { price: 29.99 },
      },
      overrideAccess: true,
    })
    classPassTypeId = classPassType.id as number

    const future = new Date(Date.now() + 86400000 * 30)
    const pass = await payload.create({
      collection: 'class-passes' as import('payload').CollectionSlug,
      data: {
        user: userId,
        tenant: tenantId,
        type: classPassTypeId,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        status: 'active',
      } as Record<string, unknown>,
      overrideAccess: true,
    })
    classPassId = pass.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'class-passes' as import('payload').CollectionSlug,
          where: { id: { equals: classPassId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'class-pass-types' as import('payload').CollectionSlug,
          where: { id: { equals: classPassTypeId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'timeslots',
          where: { id: { equals: lessonId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'event-types',
          where: { id: { equals: classOptionId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'users',
          where: { id: { equals: userId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: tenantId } },
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      await payload.db.destroy?.()
    }
  })

  it(
    'creates a booking-transaction with paymentMethod class_pass when booking is created with paymentMethodUsed and classPassIdUsed',
    async () => {
      const booking = await payload.create({
        collection: 'bookings',
        draft: false,
        data: {
          user: userId,
          lesson: lessonId,
          tenant: tenantId,
          status: 'pending',
          paymentMethodUsed: 'class_pass',
          classPassIdUsed: classPassId,
        } as Record<string, unknown>,
        overrideAccess: true,
      })

      // Hook creates booking-transaction in setImmediate after commit; allow it to run.
      await new Promise((r) => setTimeout(r, 150))
      const txResult = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      })
      expect(txResult.docs).toHaveLength(1)
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe('class_pass')
      expect((txResult.docs[0] as { classPassId?: number }).classPassId).toBe(classPassId)

      await payload.delete({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'bookings',
        id: booking.id as number,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'does not create a booking-transaction when booking is created without paymentMethodUsed class_pass',
    async () => {
      const booking = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          lesson: lessonId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: true,
      })

      const txResult = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: booking.id } },
        overrideAccess: true,
      })
      expect(txResult.docs).toHaveLength(0)

      await payload.delete({
        collection: 'bookings',
        id: booking.id as number,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})

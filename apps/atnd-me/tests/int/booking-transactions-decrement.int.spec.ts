/**
 * Booking-transactions–driven decrement: when a booking is confirmed,
 * class pass is decremented only if a booking-transaction exists with paymentMethod 'class_pass'.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Booking-transactions decrement (class_pass only)', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let classOptionId: number
  let lessonId: number
  let classPassTypeId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: 'Dec Tenant', slug: `dec-tenant-${Date.now()}` },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Dec User',
        email: `dec-user-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const co = await payload.create({
      collection: 'class-options',
      data: {
        name: `Dec Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    classOptionId = co.id as number

    const start = new Date()
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(11, 0, 0, 0)
    const lesson = await payload.create({
      collection: 'lessons',
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
        name: 'Dec Test Pass',
        slug: `dec-test-pass-${tenantId}-${Date.now()}`,
        description: 'For decrement tests',
        quantity: 10,
        tenant: tenantId,
        priceInformation: { price: 19.99 },
      },
      overrideAccess: true,
    })
    classPassTypeId = classPassType.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'class-pass-types' as import('payload').CollectionSlug,
          where: { id: { equals: classPassTypeId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'lessons',
          where: { id: { equals: lessonId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'class-options',
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
    'decrements class pass when booking confirmed and a booking-transaction has paymentMethod class_pass',
    async () => {
      const future = new Date(Date.now() + 86400000 * 30)
      const pass = await payload.create({
        collection: 'class-passes' as import('payload').CollectionSlug,
        data: {
          user: userId,
          tenant: tenantId,
          type: classPassTypeId,
          quantity: 2,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        } as Record<string, unknown>,
        overrideAccess: true,
      })

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

      await payload.create({
        collection: 'transactions' as import('payload').CollectionSlug,
        data: {
          booking: booking.id,
          paymentMethod: 'class_pass',
          classPassId: pass.id,
          tenant: tenantId,
        } as Record<string, unknown>,
        overrideAccess: true,
      })

      await payload.update({
        collection: 'bookings',
        id: booking.id as number,
        data: { status: 'confirmed' },
        overrideAccess: true,
      })

      const passAfter = await payload.findByID({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        depth: 0,
      })
      expect((passAfter as { quantity?: number }).quantity).toBe(1)
      expect((passAfter as { status?: string }).status).toBe('active')

      // Second consumption: one more booking + transaction, confirm -> quantity 0, status used
      const booking2 = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          lesson: lessonId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: true,
      })
      await payload.create({
        collection: 'transactions' as import('payload').CollectionSlug,
        data: {
          booking: booking2.id,
          paymentMethod: 'class_pass',
          classPassId: pass.id,
          tenant: tenantId,
        } as Record<string, unknown>,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'bookings',
        id: booking2.id as number,
        data: { status: 'confirmed' },
        overrideAccess: true,
      })

      const passAfter2 = await payload.findByID({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        depth: 0,
      })
      expect((passAfter2 as { quantity?: number }).quantity).toBe(0)
      expect((passAfter2 as { status?: string }).status).toBe('used')

      const txDocs = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { or: [{ booking: { equals: booking.id } }, { booking: { equals: booking2.id } }] },
        overrideAccess: true,
      })
      for (const tx of txDocs.docs) {
        await payload.delete({
          collection: 'transactions' as import('payload').CollectionSlug,
          id: (tx as { id: number }).id,
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'bookings',
        id: booking2.id as number,
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'bookings',
        id: booking.id as number,
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'does not decrement when only a stripe booking-transaction exists and booking is confirmed',
    async () => {
      const future = new Date(Date.now() + 86400000 * 30)
      const pass = await payload.create({
        collection: 'class-passes' as import('payload').CollectionSlug,
        data: {
          user: userId,
          tenant: tenantId,
          type: classPassTypeId,
          quantity: 1,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        } as Record<string, unknown>,
        overrideAccess: true,
      })

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

      await payload.create({
        collection: 'transactions' as import('payload').CollectionSlug,
        data: {
          booking: booking.id,
          paymentMethod: 'stripe',
          stripePaymentIntentId: 'pi_stripe_only',
          tenant: tenantId,
        } as Record<string, unknown>,
        overrideAccess: true,
      })

      await payload.update({
        collection: 'bookings',
        id: booking.id as number,
        data: { status: 'confirmed' },
        overrideAccess: true,
      })

      const passAfter = await payload.findByID({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        depth: 0,
      })
      expect((passAfter as { quantity?: number }).quantity).toBe(1)
      expect((passAfter as { status?: string }).status).toBe('active')

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
      await payload.delete({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'does not decrement when booking is confirmed but no booking-transaction exists',
    async () => {
      const future = new Date(Date.now() + 86400000 * 30)
      const pass = await payload.create({
        collection: 'class-passes' as import('payload').CollectionSlug,
        data: {
          user: userId,
          tenant: tenantId,
          type: classPassTypeId,
          quantity: 1,
          expirationDate: future.toISOString().slice(0, 10),
          purchasedAt: new Date().toISOString(),
          status: 'active',
        } as Record<string, unknown>,
        overrideAccess: true,
      })

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

      await payload.update({
        collection: 'bookings',
        id: booking.id as number,
        data: { status: 'confirmed' },
        overrideAccess: true,
      })

      const passAfter = await payload.findByID({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        depth: 0,
      })
      expect((passAfter as { quantity?: number }).quantity).toBe(1)
      expect((passAfter as { status?: string }).status).toBe('active')

      await payload.delete({
        collection: 'bookings',
        id: booking.id as number,
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'class-passes' as import('payload').CollectionSlug,
        id: pass.id as number,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})

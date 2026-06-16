/**
 * Drop-in fee breakdown: getDropInFeeBreakdown returns correct total (class + fee).
 * Ensures the total displayed in checkout includes the booking fee.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@/trpc/router'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Drop-in fee breakdown total', () => {
  let payload: Payload
  let tenantId: number
  let lessonId: number
  let classOptionId: number
  let userId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Fee Breakdown Tenant',
        slug: `fee-breakdown-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = (await payload.create({
      collection: 'users',
      data: {
        name: 'Fee Breakdown User',
        email: `fee-breakdown-user-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
    userId = user.id as number

    await payload.updateGlobal({
      slug: 'platform-fees',
      data: {
        defaults: { dropInPercent: 10, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [{ tenant: tenantId, dropInPercent: 10 }],
      },
      depth: 0,
      overrideAccess: true,
    } as Parameters<typeof payload.updateGlobal>[0])

    const co = await payload.create({
      collection: 'event-types',
      data: {
        name: `Fee Breakdown Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    classOptionId = co.id as number

    const startTime = new Date()
    startTime.setHours(14, 0, 0, 0)
    const endTime = new Date(startTime)
    endTime.setHours(15, 0, 0, 0)
    const lesson = await payload.create({
      collection: 'timeslots',
      draft: false,
      data: {
        tenant: tenantId,
        eventType: co.id,
        date: startTime.toISOString().split('T')[0],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        lockOutTime: 60,
        active: true,
      },
      overrideAccess: true,
    })
    lessonId = lesson.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) {
      try {
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
      await payload.db?.destroy?.()
    }
  })

  it(
    'getDropInFeeBreakdown returns totalCents = classPriceCents + bookingFeeCents',
    async () => {
      const ctx = await createTRPCContext({
        headers: new Headers(),
        payload,
        user: { id: userId },
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
      })
      const caller = appRouter.createCaller(ctx)

      const classPriceCents = 1000
      const result = await caller.payments.getDropInFeeBreakdown({
        timeslotId: lessonId,
        classPriceCents,
      })

      expect(result.classPriceCents).toBe(1000)
      expect(result.bookingFeeCents).toBe(100)
      expect(result.totalCents).toBe(1100)
      expect(result.totalCents).toBe(result.classPriceCents + result.bookingFeeCents)
    },
    TEST_TIMEOUT,
  )
})

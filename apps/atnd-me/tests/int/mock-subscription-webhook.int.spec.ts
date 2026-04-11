/**
 * Integration test: mock-subscription-created-webhook route.
 * Exercises the full flow (signed event -> real webhook -> subscription + booking created)
 * without mocking verifyStripeConnectWebhook.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('@/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(() => false),
  markStripeConnectEventProcessed: vi.fn(),
}))

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/test/mock-subscription-created-webhook/route'

const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)

describe('mock-subscription-created-webhook', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let planId: number
  let lessonId: number
  let userEmail: string
  const accountId = `acct_mock_sub_test_${runId}`
  const stripeCustomerId = `cus_mock_sub_test_${runId}`

  beforeAll(async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
    process.env.ENABLE_TEST_WEBHOOKS = 'true'

    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Mock Sub Tenant',
        slug: `mock-sub-tenant-${Date.now()}`,
        stripeConnectAccountId: accountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    userEmail = `mock-sub-user-${Date.now()}@test.com`
    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Mock Sub User',
        email: userEmail,
        password: 'test',
        role: ['user'],
        emailVerified: true,
        stripeCustomerId,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const plan = await payload.create({
      collection: 'plans',
      data: {
        name: 'Mock Sub Plan',
        status: 'active',
        tenant: tenantId,
        stripeProductId: 'prod_mock_sub',
      },
      overrideAccess: true,
    })
    planId = plan.id as number

    const co = await payload.create({
      collection: 'event-types',
      data: {
        name: `Mock Sub Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: tenantId,
      },
      overrideAccess: true,
    })

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

    const booking = await payload.create({
      collection: 'bookings',
      draft: false,
      data: {
        user: userId,
        timeslot: lessonId,
        tenant: tenantId,
        status: 'pending',
      },
      overrideAccess: true,
    })
    const bookingId = booking.id as number
  }, 60000)

  afterAll(async () => {
    if (payload?.db) {
      try {
        const subs = await payload.find({
          collection: 'subscriptions' as import('payload').CollectionSlug,
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        for (const s of subs.docs) {
          await payload.delete({
            collection: 'subscriptions' as import('payload').CollectionSlug,
            id: s.id,
            overrideAccess: true,
          })
        }
        const txResult = await payload.find({
          collection: 'transactions' as import('payload').CollectionSlug,
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        for (const t of txResult.docs) {
          await payload.delete({
            collection: 'transactions' as import('payload').CollectionSlug,
            id: t.id,
            overrideAccess: true,
          })
        }
        const bookingsResult = await payload.find({
          collection: 'bookings',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        for (const b of bookingsResult.docs) {
          await payload.delete({
            collection: 'bookings',
            id: b.id,
            overrideAccess: true,
          })
        }
        const timeslotsResult = await payload.find({
          collection: 'timeslots',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        for (const l of timeslotsResult.docs) {
          await payload.delete({
            collection: 'timeslots',
            id: l.id,
            overrideAccess: true,
          })
        }
        const coResult = await payload.find({
          collection: 'event-types',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        for (const c of coResult.docs) {
          await payload.delete({
            collection: 'event-types',
            id: c.id,
            overrideAccess: true,
          })
        }
        await payload.delete({ collection: 'plans', id: planId, overrideAccess: true })
        await payload.delete({ collection: 'users', where: { id: { equals: userId } }, overrideAccess: true })
        await payload.delete({ collection: 'tenants', where: { id: { equals: tenantId } }, overrideAccess: true })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'creates subscription and confirms booking when mock webhook is called with lessonId',
    async () => {
      const bookingsBefore = await payload.find({
        collection: 'bookings',
        where: { user: { equals: userId }, timeslot: { equals: lessonId } },
        overrideAccess: true,
      })
      const pendingBooking = bookingsBefore.docs[0]
      expect(pendingBooking?.status).toBe('pending')

      const req = new NextRequest('http://localhost/api/test/mock-subscription-created-webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userEmail, lessonId, tenantId }),
      })

      const res = await POST(req)
      if (res.status !== 200) {
        const body = await res.text()
        throw new Error(`Expected 200, got ${res.status}: ${body}`)
      }

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { tenant: { equals: tenantId } },
        depth: 0,
        overrideAccess: true,
      })
      expect(subs.totalDocs).toBeGreaterThanOrEqual(1)
      const sub = subs.docs[0] as { tenant?: number; user?: number; plan?: number; status?: string }
      expect(sub.tenant).toBe(tenantId)
      expect(sub.user).toBe(userId)
      expect(sub.plan).toBe(planId)
      expect(sub.status).toBe('active')

      const updatedBooking = await payload.findByID({
        collection: 'bookings',
        id: pendingBooking!.id,
        overrideAccess: true,
      }) as { status?: string }
      expect(updatedBooking.status).toBe('confirmed')

      const tx = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: pendingBooking!.id } },
        overrideAccess: true,
      })
      expect(tx.totalDocs).toBe(1)
    },
    TEST_TIMEOUT,
  )
})

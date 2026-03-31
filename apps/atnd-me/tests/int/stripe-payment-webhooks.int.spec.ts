/**
 * Step 2.8 – Connect-aware webhooks for payment lifecycle.
 * - When receiving payment_intent.succeeded, identify tenant via event.account (Connect) or metadata.tenantId.
 * - Updates booking/payment records in the correct tenant context.
 * - Creates booking when lessonId+userId in metadata (drop-in flow, no pre-created booking).
 *
 * Event structure matches Stripe payment_intent.succeeded (platform/destination charges).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('@/lib/stripe-connect/webhookVerify', () => ({
  verifyStripeConnectWebhook: vi.fn(),
}))
vi.mock('@/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(),
  markStripeConnectEventProcessed: vi.fn(),
}))

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe/webhook/route'
import * as webhookVerify from '@/lib/stripe-connect/webhookVerify'
import * as webhookProcessed from '@/lib/stripe-connect/webhookProcessed'
import { createPaymentIntentSucceededEvent } from '../helpers/stripe-webhook-event'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const connectAccountId = `acct_payment_webhook_${runId}`

function request(body: string, signature = 't=123,v1=valid') {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  })
}

describe('Stripe payment webhooks (step 2.8)', () => {
  let payload: Payload
  let tenantId: number
  let bookingId: number
  let lessonId: number
  let classOptionId: number
  let userId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Payment Webhook Tenant',
        slug: `payment-webhook-tenant-${Date.now()}`,
        stripeConnectAccountId: connectAccountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Payment Webhook User',
        email: `payment-webhook-user-${Date.now()}@test.com`,
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
        name: `Payment Webhook Class ${Date.now()}`,
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
      collection: 'lessons',
      draft: false,
      data: {
        tenant: tenantId,
        classOption: classOptionId,
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
      data: {
        user: userId,
        lesson: lessonId,
        tenant: tenantId,
        status: 'pending',
      },
      overrideAccess: true,
    })
    bookingId = booking.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReset()
    vi.mocked(webhookProcessed.markStripeConnectEventProcessed).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(false)
  })

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'bookings',
          where: { id: { equals: bookingId } },
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
      await payload.db?.destroy?.()
    }
  })

  it(
    'payment_intent.succeeded: identifies tenant via event.account (Connect) and updates booking',
    async () => {
      const event = createPaymentIntentSucceededEvent({
        id: 'evt_pi_succeeded_1',
        account: connectAccountId,
        paymentIntentId: 'pi_test_123',
        metadata: {
          tenantId: String(tenantId),
          bookingId: String(bookingId),
          classPriceAmount: '1900',
          bookingFeeAmount: '38',
          lessonId: String(lessonId),
          userId: String(userId),
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)
      expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith('evt_pi_succeeded_1')

      const updated = await payload.findByID({
        collection: 'bookings',
        id: bookingId,
        overrideAccess: true,
      })
      expect(updated.status).toBe('confirmed')

      const txResult = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: bookingId } },
        overrideAccess: true,
      })
      expect(txResult.docs).toHaveLength(1)
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe('stripe')
      expect((txResult.docs[0] as { stripePaymentIntentId?: string }).stripePaymentIntentId).toBe('pi_test_123')
    },
    TEST_TIMEOUT,
  )

  it(
    'payment_intent.succeeded: identifies tenant via metadata.tenantId when event.account absent',
    async () => {
      const booking2 = await payload.create({
        collection: 'bookings',
        data: { user: userId, lesson: lessonId, tenant: tenantId, status: 'pending' },
        overrideAccess: true,
      })
      const event = createPaymentIntentSucceededEvent({
        id: 'evt_pi_succeeded_2',
        paymentIntentId: 'pi_test_456',
        metadata: {
          tenantId: String(tenantId),
          bookingId: String(booking2.id),
          classPriceAmount: '1900',
          bookingFeeAmount: '38',
          lessonId: String(lessonId),
          userId: String(userId),
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const updated = await payload.findByID({
        collection: 'bookings',
        id: booking2.id,
        overrideAccess: true,
      })
      expect(updated.status).toBe('confirmed')

      const txResult = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: booking2.id } },
        overrideAccess: true,
      })
      expect(txResult.docs).toHaveLength(1)
      expect((txResult.docs[0] as { paymentMethod?: string }).paymentMethod).toBe('stripe')
      expect((txResult.docs[0] as { stripePaymentIntentId?: string }).stripePaymentIntentId).toBe('pi_test_456')

      await payload.delete({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: booking2.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'bookings',
        id: booking2.id,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'payment_intent.succeeded: confirms existing pending when lessonId+userId in metadata (quantity 1)',
    async () => {
      const lessonConfirm = await payload.create({
        collection: 'lessons',
        draft: false,
        data: {
          tenant: tenantId,
          classOption: classOptionId,
          date: new Date().toISOString().split('T')[0],
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
          lockOutTime: 60,
          active: true,
        },
        overrideAccess: true,
      })
      const lessonConfirmId = lessonConfirm.id as number
      const pendingBooking = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          lesson: lessonConfirmId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: true,
      })

      const event = createPaymentIntentSucceededEvent({
        id: 'evt_pi_succeeded_confirm',
        account: connectAccountId,
        paymentIntentId: 'pi_test_confirm_789',
        metadata: {
          tenantId: String(tenantId),
          lessonId: String(lessonConfirmId),
          userId: String(userId),
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)
      expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith('evt_pi_succeeded_confirm')

      const updated = await payload.findByID({
        collection: 'bookings',
        id: pendingBooking.id,
        overrideAccess: true,
      })
      expect(updated.status).toBe('confirmed')

      await payload.delete({
        collection: 'bookings',
        where: { id: { equals: pendingBooking.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: lessonConfirmId } },
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'payment_intent.succeeded: creates two bookings when lessonId+userId+quantity 2 in metadata',
    async () => {
      const co2 = await payload.create({
        collection: 'class-options',
        data: {
          name: `Payment Webhook Class Qty ${Date.now()}`,
          places: 10,
          description: 'Test',
          tenant: tenantId,
        },
        overrideAccess: true,
      })
      const startTime2 = new Date()
      startTime2.setHours(16, 0, 0, 0)
      const endTime2 = new Date(startTime2)
      endTime2.setHours(17, 0, 0, 0)
      const lesson2 = await payload.create({
        collection: 'lessons',
        draft: false,
        data: {
          tenant: tenantId,
          classOption: co2.id,
          date: startTime2.toISOString().split('T')[0],
          startTime: startTime2.toISOString(),
          endTime: endTime2.toISOString(),
          lockOutTime: 60,
          active: true,
        },
        overrideAccess: true,
      })
      const lesson2Id = lesson2.id as number

      const event = createPaymentIntentSucceededEvent({
        id: 'evt_pi_succeeded_qty2',
        account: connectAccountId,
        paymentIntentId: 'pi_test_qty2',
        metadata: {
          tenantId: String(tenantId),
          lessonId: String(lesson2Id),
          userId: String(userId),
          quantity: '2',
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const bookingsBefore = await payload.find({
        collection: 'bookings',
        where: { lesson: { equals: lesson2Id }, user: { equals: userId } },
        overrideAccess: true,
      })
      expect(bookingsBefore.docs.length).toBe(0)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const bookingsAfter = await payload.find({
        collection: 'bookings',
        where: { lesson: { equals: lesson2Id }, user: { equals: userId } },
        overrideAccess: true,
      })
      expect(bookingsAfter.docs.length).toBe(2)
      expect(bookingsAfter.docs.every((b) => b.status === 'confirmed')).toBe(true)

      for (const b of bookingsAfter.docs) {
        const txResult = await payload.find({
          collection: 'transactions' as import('payload').CollectionSlug,
          where: { booking: { equals: b.id } },
          overrideAccess: true,
        })
        expect(txResult.docs).toHaveLength(1)
        await payload.delete({
          collection: 'transactions' as import('payload').CollectionSlug,
          where: { booking: { equals: b.id } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'bookings',
          id: b.id,
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: lesson2Id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'class-options',
        where: { id: { equals: co2.id } },
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'payment_intent.succeeded: caps bookings to remainingCapacity when quantity exceeds capacity',
    async () => {
      const coCap = await payload.create({
        collection: 'class-options',
        data: {
          name: `Payment Webhook Class Cap ${Date.now()}`,
          places: 2,
          description: 'Test',
          tenant: tenantId,
        },
        overrideAccess: true,
      })
      const startTimeCap = new Date()
      startTimeCap.setHours(18, 0, 0, 0)
      const endTimeCap = new Date(startTimeCap)
      endTimeCap.setHours(19, 0, 0, 0)
      const lessonCap = await payload.create({
        collection: 'lessons',
        draft: false,
        data: {
          tenant: tenantId,
          classOption: coCap.id,
          date: startTimeCap.toISOString().split('T')[0],
          startTime: startTimeCap.toISOString(),
          endTime: endTimeCap.toISOString(),
          lockOutTime: 60,
          active: true,
        },
        overrideAccess: true,
      })
      const lessonCapId = lessonCap.id as number

      const otherUser = await payload.create({
        collection: 'users',
        data: {
          name: 'Cap Other User',
          email: `cap-other-${Date.now()}@test.com`,
          password: 'test',
          roles: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])
      const otherUserId = otherUser.id as number

      await payload.create({
        collection: 'bookings',
        data: {
          user: otherUserId,
          lesson: lessonCapId,
          tenant: tenantId,
          status: 'confirmed',
        },
        overrideAccess: true,
      })

      const event = createPaymentIntentSucceededEvent({
        id: 'evt_pi_succeeded_cap',
        account: connectAccountId,
        paymentIntentId: 'pi_test_cap',
        metadata: {
          tenantId: String(tenantId),
          lessonId: String(lessonCapId),
          userId: String(userId),
          quantity: '2',
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const bookingsAfter = await payload.find({
        collection: 'bookings',
        where: { lesson: { equals: lessonCapId }, user: { equals: userId } },
        overrideAccess: true,
      })
      expect(bookingsAfter.docs.length).toBe(1)
      expect(bookingsAfter.docs[0]?.status).toBe('confirmed')

      const allForLesson = await payload.find({
        collection: 'bookings',
        where: { lesson: { equals: lessonCapId } },
        overrideAccess: true,
      })
      expect(allForLesson.docs.filter((b) => b.status === 'confirmed').length).toBe(2)

      for (const b of bookingsAfter.docs) {
        await payload.delete({
          collection: 'transactions' as import('payload').CollectionSlug,
          where: { booking: { equals: b.id } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'bookings',
          id: b.id,
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'bookings',
        where: { lesson: { equals: lessonCapId }, user: { equals: otherUserId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'users',
        where: { id: { equals: otherUserId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'lessons',
        where: { id: { equals: lessonCapId } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'class-options',
        where: { id: { equals: coCap.id } },
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})

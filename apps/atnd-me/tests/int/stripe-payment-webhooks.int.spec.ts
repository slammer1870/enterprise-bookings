/**
 * Step 2.8 – Connect-aware webhooks for payment lifecycle.
 * - When receiving payment_intent.succeeded, identify tenant via event.account (Connect) or metadata.tenantId.
 * - Updates booking/payment records in the correct tenant context.
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

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

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
        stripeConnectAccountId: 'acct_payment_webhook',
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
      const event = {
        id: 'evt_pi_succeeded_1',
        type: 'payment_intent.succeeded',
        account: 'acct_payment_webhook',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { tenantId: String(tenantId), bookingId: String(bookingId) },
          },
        },
      }
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
      const event = {
        id: 'evt_pi_succeeded_2',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_456',
            metadata: { tenantId: String(tenantId), bookingId: String(booking2.id) },
          },
        },
      }
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
})

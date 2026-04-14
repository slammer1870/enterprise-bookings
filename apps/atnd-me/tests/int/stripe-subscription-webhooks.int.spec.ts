/**
 * Connect webhook: subscription lifecycle (customer.subscription.created/updated/deleted).
 * Tenant resolved from event.account; subscription and plan are tenant-scoped.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('../../src/lib/stripe-connect/webhookVerify', () => ({
  verifyStripeConnectWebhook: vi.fn(),
}))
vi.mock('../../src/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(),
  markStripeConnectEventProcessed: vi.fn(),
}))

import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/stripe/webhook/route'
import * as webhookVerify from '../../src/lib/stripe-connect/webhookVerify'
import * as webhookProcessed from '../../src/lib/stripe-connect/webhookProcessed'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)

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

describe('Stripe subscription webhooks (Connect)', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let planId: number
  const accountId = `acct_sub_webhook_test_${runId}`
  const stripeCustomerId = `cus_sub_test_123_${runId}`
  const stripeProductId = `prod_sub_plan_123_${runId}`
  const subId = `sub_test_123_${runId}`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Subscription Webhook Tenant',
        slug: `sub-webhook-tenant-${Date.now()}`,
        stripeConnectAccountId: accountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Subscription Webhook User',
        email: `sub-webhook-user-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
        // Connect webhooks match stripeCustomers; platform webhooks (no event.account) match top-level stripeCustomerId.
        stripeCustomerId,
        stripeCustomers: [{ stripeAccountId: accountId, stripeCustomerId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const plan = await payload.create({
      collection: 'plans',
      data: {
        name: 'Test Plan',
        status: 'active',
        tenant: tenantId,
        stripeProductId,
      },
      overrideAccess: true,
    })
    planId = plan.id as number
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

  function subscriptionCreatedEvent(overrides?: { account?: string; metadata?: Record<string, string> }) {
    const now = Math.floor(Date.now() / 1000)
    return {
      id: `evt_sub_created_${Date.now()}`,
      type: 'customer.subscription.created',
      account: overrides?.account ?? accountId,
      data: {
        object: {
          id: subId,
          object: 'subscription',
          customer: stripeCustomerId,
          status: 'active',
          current_period_start: now,
          current_period_end: now + 30 * 24 * 60 * 60,
          cancel_at: null,
          metadata: overrides?.metadata ?? {},
          items: {
            object: 'list',
            data: [
              {
                id: 'si_test',
                object: 'subscription_item',
                plan: { id: 'price_test', product: stripeProductId },
              },
            ],
          },
        },
      },
    }
  }

  function subscriptionUpdatedEvent(existingSubId: string, status: string) {
    const now = Math.floor(Date.now() / 1000)
    return {
      id: `evt_sub_updated_${Date.now()}`,
      type: 'customer.subscription.updated',
      account: accountId,
      data: {
        object: {
          id: existingSubId,
          object: 'subscription',
          customer: stripeCustomerId,
          status,
          current_period_start: now,
          current_period_end: now + 30 * 24 * 60 * 60,
          cancel_at: null,
          metadata: {},
          items: {
            object: 'list',
            data: [{ id: 'si_test', plan: { product: stripeProductId } }],
          },
        },
      },
    }
  }

  function subscriptionDeletedEvent(existingSubId: string) {
    const now = Math.floor(Date.now() / 1000)
    return {
      id: `evt_sub_deleted_${Date.now()}`,
      type: 'customer.subscription.deleted',
      account: accountId,
      data: {
        object: {
          id: existingSubId,
          object: 'subscription',
          customer: stripeCustomerId,
          status: 'canceled',
          current_period_end: now,
          cancel_at: now,
          metadata: {},
          items: {
            object: 'list',
            data: [{ id: 'si_test', plan: { product: stripeProductId } }],
          },
        },
      },
    }
  }

  it(
    'customer.subscription.created: creates subscription with tenant, user, plan',
    async () => {
      const event = subscriptionCreatedEvent()
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)
      expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith(event.id)

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: subId } },
        depth: 0,
        overrideAccess: true,
      })
      expect(subs.docs).toHaveLength(1)
      const sub = subs.docs[0] as { tenant?: number; user?: number; plan?: number; status?: string; stripeSubscriptionId?: string; skipSync?: boolean }
      expect(sub.tenant).toBe(tenantId)
      expect(sub.user).toBe(userId)
      expect(sub.plan).toBe(planId)
      expect(sub.status).toBe('active')
      expect(sub.stripeSubscriptionId).toBe(subId)
      expect(sub.skipSync).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'customer.subscription.updated: updates existing subscription status and period',
    async () => {
      const existing = await payload.create({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        data: {
          tenant: tenantId,
          user: userId,
          plan: planId,
          status: 'active',
          stripeSubscriptionId: 'sub_updated_test',
          skipSync: true,
        } as Record<string, unknown>,
        overrideAccess: true,
      })
      const existingSubId = (existing as { id: number }).id
      const stripeSubId = 'sub_updated_test'

      const event = subscriptionUpdatedEvent(stripeSubId, 'past_due')
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const updated = await payload.findByID({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: existingSubId,
        overrideAccess: true,
      }) as { status?: string; endDate?: string | null; skipSync?: boolean }
      expect(updated.status).toBe('past_due')
      expect(updated.skipSync).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'customer.subscription.deleted: sets subscription to canceled with endDate',
    async () => {
      const existing = await payload.create({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        data: {
          tenant: tenantId,
          user: userId,
          plan: planId,
          status: 'active',
          stripeSubscriptionId: 'sub_deleted_test',
          skipSync: true,
        } as Record<string, unknown>,
        overrideAccess: true,
      })
      const existingSubId = (existing as { id: number }).id
      const stripeSubId = 'sub_deleted_test'

      const event = subscriptionDeletedEvent(stripeSubId)
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const updated = await payload.findByID({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        id: existingSubId,
        overrideAccess: true,
      }) as { status?: string; endDate?: string | null; skipSync?: boolean }
      expect(updated.status).toBe('canceled')
      expect(updated.endDate).toBeTruthy()
      expect(updated.skipSync).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'idempotency: same event id twice returns 200 and does not create duplicate',
    async () => {
      const event = subscriptionCreatedEvent()
      ;(event as { id: string }).id = 'evt_idempotent_1'
      ;(event.data.object as { id: string }).id = 'sub_idempotent_1'
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res1 = await POST(request(JSON.stringify(event)))
      expect(res1.status).toBe(200)
      vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(true)
      const res2 = await POST(request(JSON.stringify(event)))
      expect(res2.status).toBe(200)

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: 'sub_idempotent_1' } },
        overrideAccess: true,
      })
      expect(subs.docs).toHaveLength(1)
    },
    TEST_TIMEOUT,
  )

  it(
    'unknown account: returns 200 received and does not create subscription',
    async () => {
      const event = subscriptionCreatedEvent({ account: 'acct_unknown' })
      ;(event.data.object as { id: string }).id = 'sub_unknown_acct'
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.received).toBe(true)

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: 'sub_unknown_acct' } },
        overrideAccess: true,
      })
      expect(subs.docs).toHaveLength(0)
    },
    TEST_TIMEOUT,
  )

  it(
    'customer.subscription.created (platform, no event.account): resolves tenant from metadata.tenantId and creates subscription',
    async () => {
      const event = subscriptionCreatedEvent({
        metadata: { tenantId: String(tenantId) },
      })
      ;(event.data.object as { id: string }).id = 'sub_platform_meta_123'
      delete (event as { account?: string }).account
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)
      expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith(event.id)

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: 'sub_platform_meta_123' } },
        depth: 0,
        overrideAccess: true,
      })
      expect(subs.docs).toHaveLength(1)
      const sub = subs.docs[0] as { tenant?: number; user?: number; plan?: number; status?: string; skipSync?: boolean }
      expect(sub.tenant).toBe(tenantId)
      expect(sub.user).toBe(userId)
      expect(sub.plan).toBe(planId)
      expect(sub.status).toBe('active')
      expect(sub.skipSync).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'customer.subscription.created with lessonId in metadata: creates subscription and confirms booking (subscription-from-booking-page flow)',
    async () => {
      const co = await payload.create({
        collection: 'event-types',
        data: {
          name: `Sub Booking Class ${Date.now()}`,
          places: 10,
          description: 'Test',
          tenant: tenantId,
        },
        overrideAccess: true,
      })
      const classOptionId = co.id as number

      const startTime = new Date()
      startTime.setHours(14, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(15, 0, 0, 0)
      const lesson = await payload.create({
        collection: 'timeslots',
        draft: false,
        data: {
          tenant: tenantId,
          eventType: classOptionId,
          date: startTime.toISOString().split('T')[0],
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          lockOutTime: 60,
          active: true,
        },
        overrideAccess: true,
      })
      const testTimeslotId = lesson.id as number

      const pendingBooking = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          timeslot: testTimeslotId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: true,
      })
      const pendingBookingId = pendingBooking.id as number

      const event = subscriptionCreatedEvent({
        metadata: { lessonId: String(testTimeslotId) },
      })
      ;(event.data.object as { id: string }).id = 'sub_booking_flow_123'
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: 'sub_booking_flow_123' } },
        depth: 0,
        overrideAccess: true,
      })
      expect(subs.docs).toHaveLength(1)

      const updatedBooking = await payload.findByID({
        collection: 'bookings',
        id: pendingBookingId,
        overrideAccess: true,
      }) as { status?: string }
      expect(updatedBooking.status).toBe('confirmed')

      const tx = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: pendingBookingId } },
        overrideAccess: true,
      })
      expect(tx.totalDocs).toBe(1)
      const txDoc = tx.docs[0] as { paymentMethod?: string; subscriptionId?: number }
      expect(txDoc.paymentMethod).toBe('subscription')
      expect(txDoc.subscriptionId).toBe((subs.docs[0] as { id: number }).id)
    },
    TEST_TIMEOUT,
  )

  it(
    'customer.subscription.created with bookingIds in metadata: confirms specified bookings (children flow)',
    async () => {
      const co = await payload.create({
        collection: 'event-types',
        data: {
          name: `Sub BookingIds Class ${Date.now()}`,
          places: 10,
          description: 'Test',
          tenant: tenantId,
        },
        overrideAccess: true,
      })
      const classOptionId = co.id as number

      const startTime = new Date()
      startTime.setHours(16, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(17, 0, 0, 0)
      const lesson = await payload.create({
        collection: 'timeslots',
        draft: false,
        data: {
          tenant: tenantId,
          eventType: classOptionId,
          date: startTime.toISOString().split('T')[0],
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          lockOutTime: 60,
          active: true,
        },
        overrideAccess: true,
      })
      const testTimeslotId = lesson.id as number

      const childBooking = await payload.create({
        collection: 'bookings',
        data: {
          user: userId,
          timeslot: testTimeslotId,
          tenant: tenantId,
          status: 'pending',
        },
        overrideAccess: true,
      })
      const childBookingId = childBooking.id as number

      const event = subscriptionCreatedEvent({
        metadata: { bookingIds: String(childBookingId) },
      })
      ;(event.data.object as { id: string }).id = 'sub_booking_ids_flow_123'
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const subs = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: 'sub_booking_ids_flow_123' } },
        depth: 0,
        overrideAccess: true,
      })
      expect(subs.docs).toHaveLength(1)

      const updatedBooking = await payload.findByID({
        collection: 'bookings',
        id: childBookingId,
        overrideAccess: true,
      }) as { status?: string }
      expect(updatedBooking.status).toBe('confirmed')

      const tx = await payload.find({
        collection: 'transactions' as import('payload').CollectionSlug,
        where: { booking: { equals: childBookingId } },
        overrideAccess: true,
      })
      expect(tx.totalDocs).toBe(1)
    },
    TEST_TIMEOUT,
  )
})

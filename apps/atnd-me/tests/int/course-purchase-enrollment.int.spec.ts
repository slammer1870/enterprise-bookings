/**
 * Course purchase via payment_intent.succeeded: creates enrollment with stamped access window.
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
import {
  createPaymentIntentSucceededEvent,
  createCheckoutSessionCompletedEvent,
} from '../helpers/stripe-webhook-event'
import { computeEnrollmentAccessWindow } from '@repo/bookings-payments'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const connectAccountId = `acct_course_enroll_${runId}`

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

describe('Course purchase enrollment (Stripe webhook)', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let eventTypeId: number
  let fixedCourseId: number
  let durationCourseId: number
  const fixedPurchaseTime = new Date(Date.UTC(2026, 6, 29, 12, 0, 0))

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Course Purchase Enrollment Tenant',
        slug: `course-purchase-enroll-${Date.now()}`,
        stripeConnectAccountId: connectAccountId,
        stripeConnectOnboardingStatus: 'active',
        timeZone: 'Europe/Dublin',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Course Purchase User',
        email: `course-purchase-enroll-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const eventType = await payload.create({
      collection: 'event-types',
      data: {
        name: `Course Purchase Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: tenantId,
      },
      overrideAccess: true,
    })
    eventTypeId = eventType.id as number

    const fixedCourse = await payload.create({
      collection: 'courses' as import('payload').CollectionSlug,
      data: {
        title: 'Fixed Cohort Course',
        slug: `fixed-course-${Date.now()}`,
        startDate: '2026-09-01',
        endDate: '2026-10-26',
        allowedEventTypes: [eventTypeId],
        status: 'open',
        tenant: tenantId,
        priceInformation: { price: 99 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    fixedCourseId = fixedCourse.id as number

    const durationCourse = await payload.create({
      collection: 'courses' as import('payload').CollectionSlug,
      data: {
        title: '8-Week Anytime Course',
        slug: `duration-course-${Date.now()}`,
        durationLength: 8,
        durationUnit: 'weeks',
        allowedEventTypes: [eventTypeId],
        status: 'open',
        tenant: tenantId,
        priceInformation: { price: 120 },
        maxEnrollments: 1,
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    durationCourseId = durationCourse.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID =
      process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
    process.env.ENABLE_TEST_WEBHOOKS = 'true'
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReset()
    vi.mocked(webhookProcessed.markStripeConnectEventProcessed).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(false)
  })

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'course-enrollments' as import('payload').CollectionSlug,
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'courses' as import('payload').CollectionSlug,
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'event-types',
          where: { id: { equals: eventTypeId } },
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
    'payment_intent.succeeded creates enrollment with fixed access window from course dates',
    async () => {
      const event = createPaymentIntentSucceededEvent({
        id: 'evt_course_fixed_1',
        account: connectAccountId,
        paymentIntentId: 'pi_course_fixed_1',
        metadata: {
          type: 'course_purchase',
          userId: String(userId),
          tenantId: String(tenantId),
          courseId: String(fixedCourseId),
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const enrollments = await payload.find({
        collection: 'course-enrollments' as import('payload').CollectionSlug,
        where: {
          and: [
            { user: { equals: userId } },
            { course: { equals: fixedCourseId } },
          ],
        },
        overrideAccess: true,
      })
      expect(enrollments.docs).toHaveLength(1)
      const enrollment = enrollments.docs[0] as {
        status?: string
        accessStartsAt?: string
        accessEndsAt?: string
      }
      expect(enrollment.status).toBe('active')
      // Payload date-only fields may shift when persisted; stamp from the stored course.
      const storedCourse = (await payload.findByID({
        collection: 'courses' as import('payload').CollectionSlug,
        id: fixedCourseId,
        depth: 0,
        overrideAccess: true,
      })) as { startDate?: string | null; endDate?: string | null }
      const expected = computeEnrollmentAccessWindow(
        { startDate: storedCourse.startDate, endDate: storedCourse.endDate },
        new Date(),
      )
      expect(enrollment.accessStartsAt).toBe(expected.accessStartsAt)
      expect(enrollment.accessEndsAt).toBe(expected.accessEndsAt)
    },
    TEST_TIMEOUT,
  )

  it(
    'payment_intent.succeeded stamps duration window from purchase time',
    async () => {
      vi.useFakeTimers({ now: fixedPurchaseTime, toFake: ['Date'] })
      let res: Response
      try {
        const event = createPaymentIntentSucceededEvent({
          id: 'evt_course_duration_1',
          account: connectAccountId,
          paymentIntentId: 'pi_course_duration_1',
          metadata: {
            type: 'course_purchase',
            userId: String(userId),
            tenantId: String(tenantId),
            courseId: String(durationCourseId),
          },
        })
        vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
        res = await POST(request(JSON.stringify(event)))
      } finally {
        vi.useRealTimers()
      }

      expect(res.status).toBe(200)

      const enrollments = await payload.find({
        collection: 'course-enrollments' as import('payload').CollectionSlug,
        where: {
          and: [
            { user: { equals: userId } },
            { course: { equals: durationCourseId } },
          ],
        },
        overrideAccess: true,
      })
      expect(enrollments.docs).toHaveLength(1)
      const enrollment = enrollments.docs[0] as {
        status?: string
        accessStartsAt?: string
        accessEndsAt?: string
      }
      expect(enrollment.status).toBe('active')
      const expected = computeEnrollmentAccessWindow(
        { durationLength: 8, durationUnit: 'weeks' },
        fixedPurchaseTime,
      )
      expect(enrollment.accessStartsAt).toBe(expected.accessStartsAt)
      expect(enrollment.accessEndsAt).toBe(expected.accessEndsAt)
    },
    TEST_TIMEOUT,
  )

  it(
    'checkout.session.completed with no PaymentIntent still assigns the enrollment',
    async () => {
      // Use fixed course again with a distinct transaction id (idempotent by transactionId)
      const event = createCheckoutSessionCompletedEvent({
        id: 'evt_course_zero_1',
        account: connectAccountId,
        sessionId: 'cs_course_zero_1',
        paymentIntent: null,
        amountTotal: 0,
        metadata: {
          type: 'course_purchase',
          userId: String(userId),
          tenantId: String(tenantId),
          courseId: String(fixedCourseId),
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const enrollments = await payload.find({
        collection: 'course-enrollments' as import('payload').CollectionSlug,
        where: {
          and: [
            { user: { equals: userId } },
            { course: { equals: fixedCourseId } },
            { transactionId: { equals: 'cs_course_zero_1' } },
          ],
        },
        overrideAccess: true,
      })
      expect(enrollments.docs).toHaveLength(1)
      expect((enrollments.docs[0] as { status?: string }).status).toBe('active')
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects second purchase when course is sold out',
    async () => {
      // durationCourseId has maxEnrollments: 1 and already has an active enrollment from prior test
      const otherUser = await payload.create({
        collection: 'users',
        data: {
          name: 'Course Sold Out User',
          email: `course-sold-out-${Date.now()}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])

      try {
        const event = createPaymentIntentSucceededEvent({
          id: 'evt_course_sold_out_1',
          account: connectAccountId,
          paymentIntentId: 'pi_course_sold_out_1',
          metadata: {
            type: 'course_purchase',
            userId: String(otherUser.id),
            tenantId: String(tenantId),
            courseId: String(durationCourseId),
          },
        })
        vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
        const res = await POST(request(JSON.stringify(event)))
        // Webhook still returns 200; enrollment is skipped (sold_out)
        expect(res.status).toBe(200)

        const enrollments = await payload.find({
          collection: 'course-enrollments' as import('payload').CollectionSlug,
          where: {
            and: [
              { user: { equals: otherUser.id } },
              { course: { equals: durationCourseId } },
            ],
          },
          overrideAccess: true,
        })
        expect(enrollments.docs).toHaveLength(0)
      } finally {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: otherUser.id } },
          overrideAccess: true,
        })
      }
    },
    TEST_TIMEOUT,
  )
})

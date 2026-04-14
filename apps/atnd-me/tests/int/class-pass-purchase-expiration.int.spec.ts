/**
 * Class pass purchase via payment_intent.succeeded: expirationDate follows class-pass-type daysUntilExpiration
 * (not client metadata).
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
import { classPassExpirationDateOnly } from '@repo/bookings-payments'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const connectAccountId = `acct_class_pass_exp_${runId}`

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

describe('Class pass purchase expiration (Stripe webhook)', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let classPassTypeId: number
  const fixedPurchaseTime = new Date(2026, 5, 15, 12, 0, 0)

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Class Pass Expiration Tenant',
        slug: `class-pass-exp-tenant-${Date.now()}`,
        stripeConnectAccountId: connectAccountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Class Pass Expiration User',
        email: `class-pass-exp-user-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: '30-Day Pack',
        slug: `thirty-day-pack-${Date.now()}`,
        quantity: 10,
        daysUntilExpiration: 30,
        tenant: tenantId,
        priceInformation: { price: 25 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    classPassTypeId = cpt.id as number
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
          collection: 'class-passes',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'class-pass-types',
          where: { id: { equals: classPassTypeId } },
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
    'payment_intent.succeeded creates class pass with expiration from type daysUntilExpiration (ignores metadata expirationDays)',
    async () => {
      vi.useFakeTimers({ now: fixedPurchaseTime, toFake: ['Date'] })
      let res: Response
      try {
        const event = createPaymentIntentSucceededEvent({
          id: 'evt_class_pass_exp_1',
          account: connectAccountId,
          paymentIntentId: 'pi_class_pass_exp_1',
          metadata: {
            type: 'class_pass_purchase',
            userId: String(userId),
            tenantId: String(tenantId),
            classPassTypeId: String(classPassTypeId),
            totalCents: '2500',
            expirationDays: '999',
          },
        })
        vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
        res = await POST(request(JSON.stringify(event)))
      } finally {
        vi.useRealTimers()
      }

      expect(res.status).toBe(200)

      const passes = await payload.find({
        collection: 'class-passes',
        where: { user: { equals: userId }, type: { equals: classPassTypeId } },
        overrideAccess: true,
      })
      expect(passes.docs).toHaveLength(1)
      const pass = passes.docs[0] as { expirationDate?: string; quantity?: number }
      expect(pass.quantity).toBe(10)
      expect(String(pass.expirationDate).slice(0, 10)).toBe(
        classPassExpirationDateOnly(fixedPurchaseTime, 30),
      )
    },
    TEST_TIMEOUT,
  )
})

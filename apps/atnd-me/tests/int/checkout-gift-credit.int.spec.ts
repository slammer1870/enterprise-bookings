/**
 * Checkout gift leftovers via Connect webhook:
 * - class_pass_purchase → remainder discount code (plan price only)
 * - subscription.created (active) → customer balance credit key (plan price only)
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
import { PLATFORM_STRIPE_API_VERSION } from '@/lib/stripe/platform'
import { addYearsIso } from '@/lib/stripe-connect/giftVoucherImport'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const connectAccountId = `acct_e2e_connected_${runId}`

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

function createSubscriptionCreatedEvent(overrides: {
  id: string
  account: string
  subscriptionId: string
  customerId: string
  productId: string
  status?: string
  metadata: Record<string, string>
}) {
  const {
    id,
    account,
    subscriptionId,
    customerId,
    productId,
    status = 'active',
    metadata,
  } = overrides
  const now = Math.floor(Date.now() / 1000)
  return {
    id,
    object: 'event' as const,
    api_version: PLATFORM_STRIPE_API_VERSION,
    created: now,
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription' as const,
        customer: customerId,
        status,
        current_period_start: now,
        current_period_end: now + 30 * 24 * 3600,
        metadata,
        items: {
          data: [
            {
              id: 'si_test',
              plan: { product: productId },
              price: { product: productId },
            },
          ],
        },
      },
    },
    livemode: false,
    pending_webhooks: 0,
    request: { id: 'req_test', idempotency_key: null },
    type: 'customer.subscription.created' as const,
    account,
  }
}

describe('Checkout gift credit remainders (webhook)', () => {
  let payload: Payload
  let tenantId: number
  let userId: number
  let classPassTypeId: number
  let planId: number
  const stripeCustomerId = `cus_gift_${runId}`
  const stripeProductId = `prod_gift_${runId}`
  const rootPurchasedAt = '2026-01-15T12:00:00.000Z'
  const expectedRedeemBy = addYearsIso(rootPurchasedAt, 5)

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Gift Credit Tenant',
        slug: `gift-credit-tenant-${Date.now()}`,
        stripeConnectAccountId: connectAccountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Gift Credit User',
        email: `gift-credit-user-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
        stripeCustomerId,
        stripeCustomers: [{ stripeAccountId: connectAccountId, stripeCustomerId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    userId = user.id as number

    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: 'Gift Pack',
        quantity: 5,
        daysUntilExpiration: 60,
        tenant: tenantId,
        priceInformation: { price: 19 },
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    classPassTypeId = cpt.id as number

    const plan = await payload.create({
      collection: 'plans',
      data: {
        name: 'Gift Plan',
        status: 'active',
        tenant: tenantId,
        stripeProductId,
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    planId = plan.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
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
          collection: 'discount-codes',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'class-passes',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'subscriptions',
          where: { tenant: { equals: tenantId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'class-pass-types',
          where: { id: { equals: classPassTypeId } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'plans',
          where: { id: { equals: planId } },
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
        // ignore cleanup errors
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'class_pass_purchase: amount_off leftover issues remainder code (fee ignored)',
    async () => {
      const promoCode = `CPREM${runId}`.slice(0, 24).toUpperCase()
      const parent = await payload.create({
        collection: 'discount-codes',
        data: {
          name: 'Class pass remainder parent',
          code: promoCode,
          type: 'amount_off',
          value: 30,
          currency: 'eur',
          duration: 'once',
          maxRedemptions: 1,
          rootPurchasedAt,
          redeemBy: expectedRedeemBy,
          tenant: tenantId,
          skipSync: true,
        },
        overrideAccess: true,
        context: { skipStripeSync: true },
      })

      const paymentIntentId = `pi_cp_gift_${runId}`
      const event = createPaymentIntentSucceededEvent({
        id: `evt_cp_gift_${runId}`,
        account: connectAccountId,
        paymentIntentId,
        metadata: {
          type: 'class_pass_purchase',
          userId: String(userId),
          tenantId: String(tenantId),
          classPassTypeId: String(classPassTypeId),
          discountCode: promoCode,
          planPriceAmount: '1900',
          bookingFeeAmount: '50',
          classPriceBeforeDiscount: '19',
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const parentAfter = await payload.findByID({
        collection: 'discount-codes',
        id: parent.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(parentAfter.status).toBe('archived')
      expect((parentAfter as { lastConsumedIdempotencyKey?: string }).lastConsumedIdempotencyKey).toBe(
        paymentIntentId,
      )

      const children = await payload.find({
        collection: 'discount-codes',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { parentDiscountCode: { equals: parent.id } },
          ],
        },
        overrideAccess: true,
      })
      expect(children.docs).toHaveLength(1)
      const child = children.docs[0] as {
        value?: number
        sourcePaymentIntentId?: string
        redeemBy?: string
      }
      expect(child.value).toBe(11)
      expect(child.sourcePaymentIntentId).toBe(paymentIntentId)
      expect(String(child.redeemBy).slice(0, 10)).toBe(expectedRedeemBy.slice(0, 10))
    },
    TEST_TIMEOUT,
  )

  it(
    'subscription.created: leftover credits giftBalanceCreditKey (plan only, fee ignored)',
    async () => {
      const promoCode = `SGIFT${runId}`.slice(0, 24).toUpperCase()
      const parent = await payload.create({
        collection: 'discount-codes',
        data: {
          name: 'Sub gift parent',
          code: promoCode,
          type: 'amount_off',
          value: 150,
          currency: 'eur',
          duration: 'once',
          maxRedemptions: 1,
          rootPurchasedAt,
          redeemBy: expectedRedeemBy,
          tenant: tenantId,
          skipSync: true,
        },
        overrideAccess: true,
        context: { skipStripeSync: true },
      })

      const subscriptionId = `sub_gift_${runId}`
      const event = createSubscriptionCreatedEvent({
        id: `evt_sub_gift_${runId}`,
        account: connectAccountId,
        subscriptionId,
        customerId: stripeCustomerId,
        productId: stripeProductId,
        status: 'active',
        metadata: {
          tenantId: String(tenantId),
          discountCode: promoCode,
          planPriceAmount: '10000',
          bookingFeeAmount: '500',
        },
      })
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const parentAfter = await payload.findByID({
        collection: 'discount-codes',
        id: parent.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(parentAfter.status).toBe('archived')
      expect((parentAfter as { giftBalanceCreditKey?: string }).giftBalanceCreditKey).toBe(
        subscriptionId,
      )
      expect(
        (parentAfter as { lastConsumedIdempotencyKey?: string }).lastConsumedIdempotencyKey,
      ).toBe(subscriptionId)

      // No remainder child code for subscriptions
      const children = await payload.find({
        collection: 'discount-codes',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { parentDiscountCode: { equals: parent.id } },
          ],
        },
        overrideAccess: true,
      })
      expect(children.docs).toHaveLength(0)

      // Idempotent second delivery
      vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(false)
      const event2 = {
        ...event,
        id: `evt_sub_gift_${runId}_retry`,
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event2 as never)
      const res2 = await POST(request(JSON.stringify(event2)))
      expect(res2.status).toBe(200)

      const parentAgain = await payload.findByID({
        collection: 'discount-codes',
        id: parent.id,
        depth: 0,
        overrideAccess: true,
      })
      expect((parentAgain as { giftBalanceCreditKey?: string }).giftBalanceCreditKey).toBe(
        subscriptionId,
      )
    },
    TEST_TIMEOUT,
  )
})

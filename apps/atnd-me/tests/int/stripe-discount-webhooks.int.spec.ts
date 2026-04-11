/**
 * Connect webhook: coupon / promotion_code → Payload discount-codes.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('@/lib/stripe-connect/webhookVerify', () => ({
  verifyStripeConnectWebhook: vi.fn(),
}))
vi.mock('@/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(),
  markStripeConnectEventProcessed: vi.fn(),
}))
vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: vi.fn(),
}))

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe/webhook/route'
import * as webhookVerify from '@/lib/stripe-connect/webhookVerify'
import * as webhookProcessed from '@/lib/stripe-connect/webhookProcessed'
import { getPlatformStripe } from '@/lib/stripe/platform'

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

describe('Stripe discount webhooks (Connect → Payload)', () => {
  let payload: Payload
  let tenantId: number
  const accountId = `acct_discount_sync_${runId}`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Discount Webhook Tenant',
        slug: `discount-webhook-${Date.now()}`,
        stripeConnectAccountId: accountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReset()
    vi.mocked(webhookProcessed.markStripeConnectEventProcessed).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(false)
    vi.mocked(getPlatformStripe).mockReset()
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
    'promotion_code.created: creates discount-codes doc from Stripe coupon + promo',
    async () => {
      const promoId = `promo_wh_${runId}`
      const couponId = `coupon_wh_${runId}`
      const code = `SAVE${runId}`.slice(0, 10).toUpperCase()

      vi.mocked(getPlatformStripe).mockReturnValue({
        promotionCodes: {
          retrieve: vi.fn().mockResolvedValue({
            id: promoId,
            object: 'promotion_code',
            code,
            active: true,
            coupon: {
              id: couponId,
              object: 'coupon',
              percent_off: 15,
              duration: 'once',
              name: 'Dashboard promo',
            },
          }),
        },
        coupons: {
          retrieve: vi.fn(),
        },
      } as never)

      const event = {
        id: `evt_promo_created_${runId}`,
        type: 'promotion_code.created',
        account: accountId,
        data: {
          object: {
            id: promoId,
            object: 'promotion_code',
            code,
          },
        },
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const found = await payload.find({
        collection: 'discount-codes',
        where: { stripePromotionCodeId: { equals: promoId } },
        overrideAccess: true,
      })
      expect(found.docs).toHaveLength(1)
      const doc = found.docs[0] as {
        code?: string
        type?: string
        value?: number
        status?: string
        stripeCouponId?: string
        name?: string
      }
      expect(doc.code).toBe(code)
      expect(doc.type).toBe('percentage_off')
      expect(doc.value).toBe(15)
      expect(doc.status).toBe('active')
      expect(doc.stripeCouponId).toBe(couponId)
      expect(doc.name).toBe('Dashboard promo')
    },
    TEST_TIMEOUT,
  )

  it(
    'promotion_code.updated: deactivating in Stripe archives Payload doc',
    async () => {
      const promoId = `promo_wh_inactive_${runId}`
      const couponId = `coupon_wh_inactive_${runId}`
      const code = `OFF${runId}`.slice(0, 10).toUpperCase()

      const created = await payload.create({
        collection: 'discount-codes',
        data: {
          name: 'Pre-synced',
          code,
          type: 'percentage_off',
          value: 10,
          duration: 'once',
          tenant: tenantId,
          status: 'active',
          stripeCouponId: couponId,
          stripePromotionCodeId: promoId,
        },
        overrideAccess: true,
        context: { skipStripeSync: true },
      })

      vi.mocked(getPlatformStripe).mockReturnValue({
        promotionCodes: {
          retrieve: vi.fn().mockResolvedValue({
            id: promoId,
            object: 'promotion_code',
            code,
            active: false,
            coupon: {
              id: couponId,
              object: 'coupon',
              percent_off: 10,
              duration: 'once',
            },
          }),
        },
        coupons: {
          retrieve: vi.fn(),
        },
      } as never)

      const event = {
        id: `evt_promo_updated_${runId}`,
        type: 'promotion_code.updated',
        account: accountId,
        data: { object: { id: promoId, object: 'promotion_code', code } },
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const doc = await payload.findByID({
        collection: 'discount-codes',
        id: created.id,
        overrideAccess: true,
      })
      expect((doc as { status?: string }).status).toBe('archived')
    },
    TEST_TIMEOUT,
  )

  it(
    'coupon.updated: updates value on existing discount-codes with same stripeCouponId',
    async () => {
      const couponId = `coupon_wh_upd_${runId}`
      const promoId = `promo_wh_upd_${runId}`
      const code = `UPD${runId}`.slice(0, 10).toUpperCase()

      await payload.create({
        collection: 'discount-codes',
        data: {
          name: 'Updatable',
          code,
          type: 'percentage_off',
          value: 5,
          duration: 'once',
          tenant: tenantId,
          status: 'active',
          stripeCouponId: couponId,
          stripePromotionCodeId: promoId,
        },
        overrideAccess: true,
        context: { skipStripeSync: true },
      })

      vi.mocked(getPlatformStripe).mockReturnValue({
        promotionCodes: { retrieve: vi.fn() },
        coupons: {
          retrieve: vi.fn().mockResolvedValue({
            id: couponId,
            object: 'coupon',
            percent_off: 25,
            duration: 'once',
            name: 'Renamed in Stripe',
          }),
        },
      } as never)

      const event = {
        id: `evt_coupon_updated_${runId}`,
        type: 'coupon.updated',
        account: accountId,
        data: {
          object: { id: couponId, object: 'coupon' },
        },
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const found = await payload.find({
        collection: 'discount-codes',
        where: { stripeCouponId: { equals: couponId } },
        overrideAccess: true,
      })
      expect(found.docs).toHaveLength(1)
      expect((found.docs[0] as { value?: number }).value).toBe(25)
      expect((found.docs[0] as { name?: string }).name).toBe('Renamed in Stripe')
    },
    TEST_TIMEOUT,
  )
})

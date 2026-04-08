/**
 * Connect webhook: product / price events should refresh linked plan and class-pass documents.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('../../src/lib/stripe-connect/webhookVerify', () => ({
  verifyStripeConnectWebhook: vi.fn(),
}))
vi.mock('../../src/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(),
  markStripeConnectEventProcessed: vi.fn(),
}))
vi.mock('../../src/lib/stripe/platform', () => ({
  getPlatformStripe: vi.fn(),
}))

import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/stripe/webhook/route'
import * as webhookVerify from '../../src/lib/stripe-connect/webhookVerify'
import * as webhookProcessed from '../../src/lib/stripe-connect/webhookProcessed'
import { getPlatformStripe } from '../../src/lib/stripe/platform'

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

describe('Stripe product webhooks (Connect)', () => {
  let payload: Payload
  let tenantId: number
  let planId: number
  let classPassTypeId: number
  const accountId = `acct_product_webhook_test_${runId}`
  const stripeProductId = `prod_product_webhook_${runId}`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Product Webhook Tenant',
        slug: `product-webhook-tenant-${Date.now()}`,
        stripeConnectAccountId: accountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const plan = await payload.create({
      collection: 'plans',
      data: {
        name: 'Old Plan Name',
        status: 'active',
        tenant: tenantId,
        stripeProductId,
        priceInformation: { price: 10, interval: 'month', intervalCount: 1 },
        priceJSON: JSON.stringify({ id: 'price_old_plan' }),
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    planId = plan.id as number

    const classPassType = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: 'Old Pass Name',
        slug: `old-pass-name-${Date.now()}`,
        quantity: 10,
        status: 'active',
        tenant: tenantId,
        stripeProductId,
        priceInformation: { price: 25 },
        priceJSON: JSON.stringify({ id: 'price_old_pass' }),
      },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
    classPassTypeId = classPassType.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID =
      process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReset()
    vi.mocked(webhookProcessed.markStripeConnectEventProcessed).mockReset()
    vi.mocked(getPlatformStripe).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(false)
  })

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'class-pass-types',
          id: classPassTypeId,
          overrideAccess: true,
          context: { skipStripeSync: true },
        })
        await payload.delete({
          collection: 'plans',
          id: planId,
          overrideAccess: true,
          context: { skipStripeSync: true },
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
    'syncs linked plan and class pass documents on product.updated',
    async () => {
      const stripePrice = {
        id: `price_product_updated_${runId}`,
        object: 'price',
        unit_amount: 3200,
        currency: 'eur',
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 2 },
      }

      vi.mocked(getPlatformStripe).mockReturnValue({
        products: {
          retrieve: vi.fn().mockResolvedValue({
            id: stripeProductId,
            object: 'product',
            name: 'Webhook Updated Product',
            active: false,
            default_price: stripePrice,
          }),
        },
      } as never)

      const event = {
        id: `evt_product_updated_${Date.now()}`,
        type: 'product.updated',
        account: accountId,
        data: {
          object: {
            id: stripeProductId,
            object: 'product',
          },
        },
      }

      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const response = await POST(request(JSON.stringify(event)))
      expect(response.status).toBe(200)

      const plan = await payload.findByID({ collection: 'plans', id: planId, overrideAccess: true })
      const classPassType = await payload.findByID({
        collection: 'class-pass-types',
        id: classPassTypeId,
        overrideAccess: true,
      })

      expect(plan.name).toBe('Webhook Updated Product')
      expect(plan.status).toBe('inactive')
      expect(plan.priceInformation).toMatchObject({ price: 32, interval: 'month', intervalCount: 2 })
      expect(plan.priceJSON).toBe(JSON.stringify(stripePrice))

      expect(classPassType.name).toBe('Webhook Updated Product')
      expect(classPassType.status).toBe('inactive')
      expect(classPassType.priceInformation).toMatchObject({ price: 32 })
      expect(classPassType.priceJSON).toBe(JSON.stringify(stripePrice))
    },
    TEST_TIMEOUT,
  )

  it(
    'syncs linked documents on price.updated using the price product reference',
    async () => {
      const stripePrice = {
        id: `price_price_updated_${runId}`,
        object: 'price',
        unit_amount: 4100,
        currency: 'eur',
        type: 'one_time',
      }

      vi.mocked(getPlatformStripe).mockReturnValue({
        products: {
          retrieve: vi.fn().mockResolvedValue({
            id: stripeProductId,
            object: 'product',
            name: 'Webhook Price Update',
            active: true,
            default_price: stripePrice,
          }),
        },
      } as never)

      const event = {
        id: `evt_price_updated_${Date.now()}`,
        type: 'price.updated',
        account: accountId,
        data: {
          object: {
            id: stripePrice.id,
            object: 'price',
            product: stripeProductId,
          },
        },
      }

      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

      const response = await POST(request(JSON.stringify(event)))
      expect(response.status).toBe(200)

      const plan = await payload.findByID({ collection: 'plans', id: planId, overrideAccess: true })
      const classPassType = await payload.findByID({
        collection: 'class-pass-types',
        id: classPassTypeId,
        overrideAccess: true,
      })

      expect(plan.name).toBe('Webhook Price Update')
      expect(plan.status).toBe('active')
      expect(plan.priceInformation).toMatchObject({ price: 41 })
      expect(plan.priceJSON).toBe(JSON.stringify(stripePrice))

      expect(classPassType.name).toBe('Webhook Price Update')
      expect(classPassType.status).toBe('active')
      expect(classPassType.priceInformation).toMatchObject({ price: 41 })
      expect(classPassType.priceJSON).toBe(JSON.stringify(stripePrice))
    },
    TEST_TIMEOUT,
  )
})

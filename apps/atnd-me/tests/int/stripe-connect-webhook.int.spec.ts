/**
 * Step 2.5 – Stripe Connect webhook endpoint
 * Signature verification and idempotency are mockable.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('@/lib/stripe-connect/webhookVerify', () => ({
  verifyStripeConnectWebhook: vi.fn(),
}))
vi.mock('@/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(),
  markStripeConnectEventProcessed: vi.fn(),
  resetProcessedStripeConnectEvents: vi.fn(),
}))

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe/webhook/route'
import * as webhookVerify from '@/lib/stripe-connect/webhookVerify'
import * as webhookProcessed from '@/lib/stripe-connect/webhookProcessed'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const webhookAccountId = `acct_webhook_test_${runId}`
const webhookDeauthAccountId = `acct_deauth_only_${runId}`

describe('Stripe Connect webhook (step 2.5)', () => {
  let payload: Payload
  let testTenantId: number
  let deauthTenantId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Webhook Test Tenant',
        slug: `webhook-tenant-${Date.now()}`,
        stripeConnectAccountId: webhookAccountId,
        stripeConnectOnboardingStatus: 'pending',
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    const deauthTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Webhook Deauth Tenant',
        slug: `webhook-deauth-${Date.now()}`,
        stripeConnectAccountId: webhookDeauthAccountId,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    deauthTenantId = deauthTenant.id as number
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
    if (payload) {
      try {
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [testTenantId, deauthTenantId] } },
      })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

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

  it(
    'rejects invalid signatures with 400',
    async () => {
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockImplementation(() => {
        throw new Error('Signature verification failed')
      })
      const res = await POST(request('{}'))
      expect(res.status).toBe(400)
      expect(webhookProcessed.markStripeConnectEventProcessed).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'accepts valid signature and processes account.updated',
    async () => {
      const event = {
        id: 'evt_account_updated_1',
        type: 'account.updated',
        account: webhookAccountId,
        data: { object: { charges_enabled: true } },
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)
      expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith('evt_account_updated_1')

      const updated = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        overrideAccess: true,
      })
      expect(updated.stripeConnectOnboardingStatus).toBe('active')
      expect(updated.stripeConnectAccountId).toBe(webhookAccountId)
    },
    TEST_TIMEOUT,
  )

  it(
    'processes account.application.deauthorized: marks tenant deauthorized and clears account id',
    async () => {
      const event = {
        id: 'evt_deauth_1',
        type: 'account.application.deauthorized',
        account: webhookDeauthAccountId,
        data: { object: {} },
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      const res = await POST(request(JSON.stringify(event)))
      expect(res.status).toBe(200)

      const updated = await payload.findByID({
        collection: 'tenants',
        id: deauthTenantId,
        overrideAccess: true,
      })
      expect(updated.stripeConnectOnboardingStatus).toBe('deauthorized')
      expect(updated.stripeConnectAccountId).toBeNull()
    },
    TEST_TIMEOUT,
  )

  it(
    'idempotency: replaying same event returns 200 and does not re-apply',
    async () => {
      const event = {
        id: 'evt_replay_1',
        type: 'account.updated',
        account: webhookAccountId,
        data: { object: { charges_enabled: true } },
      }
      vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)
      vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValueOnce(false).mockReturnValueOnce(true)

      const res1 = await POST(request(JSON.stringify(event)))
      expect(res1.status).toBe(200)
      expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith('evt_replay_1')

      const res2 = await POST(request(JSON.stringify(event)))
      expect(res2.status).toBe(200)
      const markCalls = vi.mocked(webhookProcessed.markStripeConnectEventProcessed).mock.calls
      expect(markCalls.filter((c) => c[0] === 'evt_replay_1')).toHaveLength(1)
    },
    TEST_TIMEOUT,
  )
})

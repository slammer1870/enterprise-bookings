/**
 * Helpers to simulate Stripe Connect webhook delivery in Playwright e2e.
 */
import { createHmac } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { BASE_URL } from './auth-helpers'

function webhookSecret(): string {
  const secret =
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error(
      'STRIPE_CONNECT_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET) is required to sign e2e webhooks',
    )
  }
  return secret
}

export function signStripeWebhookBody(body: string, secret = webhookSecret()): string {
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  return `t=${t},v1=${v1}`
}

function coursePurchasePaymentIntentEvent(args: {
  id: string
  account: string
  paymentIntentId: string
  metadata: Record<string, string>
}) {
  const apiVersion =
    process.env.STRIPE_API_VERSION?.trim() || '2026-02-25.clover'
  return {
    id: args.id,
    object: 'event' as const,
    api_version: apiVersion,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: args.paymentIntentId,
        object: 'payment_intent' as const,
        amount: 7500,
        amount_received: 7500,
        application_fee_amount: 225,
        currency: 'eur',
        customer: null,
        livemode: false,
        metadata: args.metadata,
        status: 'succeeded' as const,
        transfer_data: { destination: args.account },
      },
    },
    livemode: false,
    pending_webhooks: 0,
    request: { id: 'req_e2e_course', idempotency_key: null },
    type: 'payment_intent.succeeded' as const,
    account: args.account,
  }
}

export async function postCoursePurchaseWebhook(
  request: APIRequestContext,
  args: {
    connectAccountId: string
    userId: number
    tenantId: number
    courseId: number
    paymentIntentId?: string
    eventId?: string
  },
): Promise<{ status: number; body: unknown }> {
  const paymentIntentId =
    args.paymentIntentId ?? `pi_e2e_course_${args.courseId}_${Date.now()}`
  const event = coursePurchasePaymentIntentEvent({
    id: args.eventId ?? `evt_e2e_course_${Date.now()}`,
    account: args.connectAccountId,
    paymentIntentId,
    metadata: {
      type: 'course_purchase',
      userId: String(args.userId),
      tenantId: String(args.tenantId),
      courseId: String(args.courseId),
    },
  })
  const body = JSON.stringify(event)
  const res = await request.post(`${BASE_URL}/api/stripe/webhook`, {
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signStripeWebhookBody(body),
    },
    data: body,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), body: json }
}

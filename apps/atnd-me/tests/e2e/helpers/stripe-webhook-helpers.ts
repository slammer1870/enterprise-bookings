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

function paymentIntentSucceededEvent(args: {
  id: string
  account: string
  paymentIntentId: string
  metadata: Record<string, string>
  amount?: number
  requestId?: string
}) {
  const apiVersion =
    process.env.STRIPE_API_VERSION?.trim() || '2026-02-25.clover'
  const amount = args.amount ?? 7500
  return {
    id: args.id,
    object: 'event' as const,
    api_version: apiVersion,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: args.paymentIntentId,
        object: 'payment_intent' as const,
        amount,
        amount_received: amount,
        application_fee_amount: Math.max(1, Math.round(amount * 0.03)),
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
    request: { id: args.requestId ?? 'req_e2e', idempotency_key: null },
    type: 'payment_intent.succeeded' as const,
    account: args.account,
  }
}

async function postSignedWebhook(
  request: APIRequestContext,
  event: unknown,
): Promise<{ status: number; body: unknown }> {
  const body = JSON.stringify(event)
  const res = await request.post(`${BASE_URL}/api/stripe/webhook`, {
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signStripeWebhookBody(body),
    },
    data: body,
    // Dev cold-compile of the webhook route can exceed the default 10s actionTimeout.
    timeout: 60_000,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), body: json }
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
  const event = paymentIntentSucceededEvent({
    id: args.eventId ?? `evt_e2e_course_${Date.now()}`,
    account: args.connectAccountId,
    paymentIntentId,
    requestId: 'req_e2e_course',
    metadata: {
      type: 'course_purchase',
      userId: String(args.userId),
      tenantId: String(args.tenantId),
      courseId: String(args.courseId),
    },
  })
  return postSignedWebhook(request, event)
}

/**
 * Simulate payment_intent.succeeded for an event/drop-in checkout hold.
 * Webhook fulfills the hold into confirmed bookings (same path as live Stripe).
 */
export async function postHoldFulfillmentWebhook(
  request: APIRequestContext,
  args: {
    connectAccountId: string
    userId: number
    tenantId: number
    holdId: number
    paymentIntentId?: string
    eventId?: string
    timeslotId?: number
    quantity?: number
    /** Drop-in product id — required for once-per-user tracking on fulfill. */
    dropInId?: number
  },
): Promise<{ status: number; body: unknown }> {
  const paymentIntentId =
    args.paymentIntentId ?? `pi_e2e_hold_${args.holdId}_${Date.now()}`
  const event = paymentIntentSucceededEvent({
    id: args.eventId ?? `evt_e2e_hold_${Date.now()}`,
    account: args.connectAccountId,
    paymentIntentId,
    requestId: 'req_e2e_hold',
    amount: Math.max(100, (args.quantity ?? 1) * 1500),
    metadata: {
      userId: String(args.userId),
      tenantId: String(args.tenantId),
      holdId: String(args.holdId),
      ...(args.timeslotId != null ? { timeslotId: String(args.timeslotId) } : {}),
      ...(args.quantity != null ? { quantity: String(args.quantity) } : {}),
      ...(args.dropInId != null ? { dropInId: String(args.dropInId) } : {}),
    },
  })
  return postSignedWebhook(request, event)
}

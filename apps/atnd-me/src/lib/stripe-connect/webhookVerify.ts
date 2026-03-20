/**
 * Stripe Connect webhook signature verification (step 2.5).
 * Verifies Stripe-Signature (t=timestamp,v1=hmac) using raw body and endpoint secret.
 * Supports two secrets: Connect (account/subscription events) and platform (payment_intent.succeeded
 * for destination charges, which Stripe sends to the platform webhook, not the Connect one).
 * Callers can mock this in tests.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getStripeConnectEnv } from '@/lib/stripe/platform'

export type StripeConnectEvent = {
  id: string
  type: string
  /** API version used to render `data` (set on the webhook endpoint, or platform default). */
  api_version?: string | null
  account?: string | { id?: string }
  data?: { object?: Record<string, unknown> }
  [k: string]: unknown
}

function verifyWithSecret(
  body: string,
  signature: string,
  webhookSecret: string,
): void {
  const parts = signature.split(',')
  const entries: Record<string, string> = {}
  for (const part of parts) {
    const [k, v] = part.split('=')
    if (k && v) entries[k.trim()] = v.trim()
  }
  const t = entries['t']
  const v1 = entries['v1']
  if (!t || !v1) {
    throw new Error('Invalid Stripe-Signature: missing t or v1')
  }
  const payload = `${t}.${body}`
  const expected = createHmac('sha256', webhookSecret).update(payload).digest('hex')
  const received = Buffer.from(v1, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  if (
    received.length !== expectedBuf.length ||
    !timingSafeEqual(new Uint8Array(received), new Uint8Array(expectedBuf))
  ) {
    throw new Error('Webhook signature verification failed')
  }
}

/**
 * Verifies Stripe webhook signature (v1) and returns parsed event.
 * Tries STRIPE_CONNECT_WEBHOOK_SECRET first (Connect events), then STRIPE_WEBHOOK_SECRET
 * (platform events like payment_intent.succeeded for destination charges).
 * @throws Error when signature is invalid or body is not valid JSON
 */
export function verifyStripeConnectWebhook(
  rawBody: string | Buffer,
  signature: string,
  secret?: string,
): StripeConnectEvent {
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')

  const secretsToTry: string[] = []
  if (secret) {
    secretsToTry.push(secret)
  } else {
    // Try Connect webhook secret from env first so verification works in test/CI
    // without requiring STRIPE_CONNECT_CLIENT_ID (getStripeConnectEnv asserts all vars).
    const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim()
    if (connectSecret) secretsToTry.push(connectSecret)
    try {
      secretsToTry.push(getStripeConnectEnv().webhookSecret)
    } catch {
      // Omit when STRIPE_SECRET_KEY / STRIPE_CONNECT_CLIENT_ID not set (e.g. test env)
    }
    const platformSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    if (platformSecret) secretsToTry.push(platformSecret)
  }

  let verified = false
  for (const webhookSecret of secretsToTry) {
    try {
      verifyWithSecret(body, signature, webhookSecret)
      verified = true
      break
    } catch {
      continue
    }
  }
  if (!verified) {
    throw new Error('Webhook signature verification failed')
  }

  const event = JSON.parse(body) as StripeConnectEvent
  if (!event.id || !event.type) {
    throw new Error('Invalid event: missing id or type')
  }
  return event
}

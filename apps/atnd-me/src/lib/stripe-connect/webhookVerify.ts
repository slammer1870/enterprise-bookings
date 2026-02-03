/**
 * Stripe Connect webhook signature verification (step 2.5).
 * Verifies Stripe-Signature (t=timestamp,v1=hmac) using raw body and endpoint secret.
 * Callers can mock this in tests.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getStripeConnectEnv } from '@/lib/stripe/platform'

export type StripeConnectEvent = {
  id: string
  type: string
  account?: string | { id?: string }
  data?: { object?: Record<string, unknown> }
  [k: string]: unknown
}

/**
 * Verifies Stripe webhook signature (v1) and returns parsed event.
 * @throws Error when signature is invalid or body is not valid JSON
 */
export function verifyStripeConnectWebhook(
  rawBody: string | Buffer,
  signature: string,
  secret?: string,
): StripeConnectEvent {
  const webhookSecret = secret ?? getStripeConnectEnv().webhookSecret
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')

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

  const event = JSON.parse(body) as StripeConnectEvent
  if (!event.id || !event.type) {
    throw new Error('Invalid event: missing id or type')
  }
  return event
}

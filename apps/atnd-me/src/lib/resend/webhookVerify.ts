import { Webhook } from 'svix'

export type ResendWebhookEvent = {
  type: string
  created_at?: string
  data: {
    id?: string
    name?: string
    status?: string
    [key: string]: unknown
  }
}

/**
 * Verify a Resend (Svix) webhook signature and return the parsed event.
 * Throws on missing secret, missing headers, or invalid signature.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: {
    id: string | null
    timestamp: string | null
    signature: string | null
  },
): ResendWebhookEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error('RESEND_WEBHOOK_SECRET is not set')
  }

  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) {
    throw new Error('Missing Svix signature headers')
  }

  // E2E / unit: allow a fixed test secret without real Svix signatures when enabled.
  if (
    process.env.NODE_ENV !== 'production' &&
    (process.env.ENABLE_TEST_WEBHOOKS === 'true' || process.env.NODE_ENV === 'test') &&
    secret === 'test_resend_webhook_secret' &&
    signature === 'test'
  ) {
    return JSON.parse(rawBody) as ResendWebhookEvent
  }

  const wh = new Webhook(secret)
  return wh.verify(rawBody, {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': signature,
  }) as ResendWebhookEvent
}

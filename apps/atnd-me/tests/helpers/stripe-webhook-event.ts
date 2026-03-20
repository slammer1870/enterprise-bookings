import { PLATFORM_STRIPE_API_VERSION } from '@/lib/stripe/platform'

/**
 * Factory for Stripe payment_intent.succeeded event mocks.
 * Matches Stripe's structure for platform/destination charges (atnd-me Connect flow).
 *
 * Use in int tests (webhook route POST) and e2e tests (simulating webhook delivery).
 */
export function createPaymentIntentSucceededEvent(overrides: {
  id?: string
  account?: string
  paymentIntentId?: string
  metadata: Record<string, string>
}) {
  const { id = 'evt_test', account, paymentIntentId = 'pi_test_123', metadata } = overrides
  return {
    id,
    object: 'event' as const,
    api_version: PLATFORM_STRIPE_API_VERSION,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: paymentIntentId,
        object: 'payment_intent' as const,
        amount: 1938,
        amount_received: 1938,
        application_fee_amount: 38,
        currency: 'eur',
        customer: null,
        livemode: false,
        metadata,
        status: 'succeeded' as const,
        transfer_data: account ? { destination: account } : undefined,
      },
    },
    livemode: false,
    pending_webhooks: 0,
    request: { id: 'req_test', idempotency_key: null },
    type: 'payment_intent.succeeded' as const,
    ...(account ? { account } : {}),
  }
}

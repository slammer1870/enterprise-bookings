'server-only'

import Stripe from 'stripe'

import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

/** Default when `STRIPE_API_VERSION` is unset (Clover). */
const DEFAULT_PLATFORM_STRIPE_API_VERSION = '2026-02-25.clover'

function resolvePlatformStripeApiVersion(): string {
  const fromEnv = process.env.STRIPE_API_VERSION?.trim()
  return fromEnv || DEFAULT_PLATFORM_STRIPE_API_VERSION
}

/**
 * Resolved Stripe API version for API calls and Connect webhook `api_version` checks.
 * Override with `STRIPE_API_VERSION`; defaults to Clover `2026-02-25.clover`.
 * @see https://docs.stripe.com/upgrades
 */
export const PLATFORM_STRIPE_API_VERSION =
  resolvePlatformStripeApiVersion() as Stripe.LatestApiVersion

/** Required env vars for Stripe Connect; throws if any are missing. */
export function assertStripeConnectEnv(): void {
  const sk = process.env.STRIPE_SECRET_KEY
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!sk?.trim()) {
    throw new Error('STRIPE_SECRET_KEY is required for Stripe Connect')
  }
  if (!clientId?.trim()) {
    throw new Error('STRIPE_CONNECT_CLIENT_ID is required for Stripe Connect')
  }
  if (!webhookSecret?.trim()) {
    throw new Error('STRIPE_CONNECT_WEBHOOK_SECRET is required for Stripe Connect')
  }
}

/** Platform secret vs webhook secret are separate; use the right one for each purpose. */
export function getStripeConnectEnv(): {
  platformSecretKey: string
  connectClientId: string
  webhookSecret: string
} {
  assertStripeConnectEnv()
  return {
    platformSecretKey: process.env.STRIPE_SECRET_KEY!,
    connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID!,
    webhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET!,
  }
}

let platformStripe: Stripe | null = null

/** Platform Stripe client (singleton). Throws if STRIPE_SECRET_KEY is missing. */
export function getPlatformStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new Error('STRIPE_SECRET_KEY is required to create the Stripe client')
  }
  if (!platformStripe) {
    const raw = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: PLATFORM_STRIPE_API_VERSION,
    })
    // Wrap paymentIntents.create so E2E/test account IDs never hit the real Stripe API.
    const rawCreate = raw.paymentIntents.create.bind(raw.paymentIntents)
    raw.paymentIntents.create = async (params: Stripe.PaymentIntentCreateParams, options?: Stripe.RequestOptions) => {
      const accountId =
        options?.stripeAccount ??
        (params as { on_behalf_of?: string }).on_behalf_of ??
        (params as { transfer_data?: { destination?: string } }).transfer_data?.destination ??
        null
      if (isStripeTestAccount(accountId)) {
        const mockId = `pi_test_${Date.now()}`
        const mock = {
          id: mockId,
          client_secret: `${mockId}_secret_test`,
          lastResponse: { headers: {} as Record<string, string>, requestId: 'mock', statusCode: 200 },
        }
        return Promise.resolve(mock as Stripe.Response<Stripe.PaymentIntent>)
      }
      return rawCreate(params, options)
    }
    platformStripe = raw
  }
  return platformStripe
}

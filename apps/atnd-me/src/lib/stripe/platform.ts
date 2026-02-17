'server-only'

import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-02-24.acacia' as const

/** E2E/test Connect account ID prefixes; match test-accounts.ts. */
const E2E_ACCOUNT_REGEX =
  /^acct_(fee_disclosure_|smoke_|cp_only_|dropin_discount_|e2e_connected_|e2e_gated_|leave_)/
function isStripeTestAccount(id: string | null | undefined): boolean {
  return Boolean(id?.trim() && E2E_ACCOUNT_REGEX.test(id.trim()))
}

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
      apiVersion: STRIPE_API_VERSION,
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

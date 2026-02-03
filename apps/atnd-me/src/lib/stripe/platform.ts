'server-only'

import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-02-24.acacia' as const

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
    platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    })
  }
  return platformStripe
}

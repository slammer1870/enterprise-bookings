/**
 * Exchange Stripe Connect OAuth code for account id (step 2.4).
 * Callers can mock this in tests.
 */
import { getStripeConnectEnv } from '@/lib/stripe/platform'

export type ExchangeResult = {
  stripe_user_id: string
  stripe_account_id: string
}

export async function exchangeCodeForStripeConnectAccount(
  code: string,
  redirectUri: string,
): Promise<ExchangeResult> {
  const { platformSecretKey } = getStripeConnectEnv()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_secret: platformSecretKey,
    redirect_uri: redirectUri,
  })
  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = (await res.json()) as
    | { stripe_user_id?: string; stripe_account_id?: string; error?: string; error_description?: string }
  if (!res.ok || data.error) {
    const msg = data.error_description ?? data.error ?? `Stripe OAuth error: ${res.status}`
    throw new Error(msg)
  }
  const accountId = data.stripe_account_id ?? data.stripe_user_id
  if (!accountId) {
    throw new Error('Stripe response missing account id')
  }
  return {
    stripe_user_id: data.stripe_user_id ?? accountId,
    stripe_account_id: accountId,
  }
}

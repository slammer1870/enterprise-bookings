import type Stripe from 'stripe'

import type { TenantStripeStatus } from '@/lib/stripe-connect/tenantStripe'

type StripeAccountStatusLike = Pick<
  Stripe.Account,
  'charges_enabled' | 'details_submitted'
>

export function getStripeConnectOnboardingStatus(
  account: StripeAccountStatusLike | null | undefined,
): TenantStripeStatus {
  // `charges_enabled` is Stripe's definitive signal that the account can accept
  // payments. Requirements with future deadlines, paused payouts, and pending
  // verifications do not affect this flag.
  if (account?.charges_enabled) return 'active'

  // Details submitted but charges disabled — account is in review or has
  // outstanding requirements that Stripe has actioned.
  if (account?.details_submitted) return 'restricted'

  // No account, or details not yet submitted — still in the onboarding flow.
  return 'pending'
}

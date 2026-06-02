import type Stripe from 'stripe'

import type { TenantStripeStatus } from '@/lib/stripe-connect/tenantStripe'

type StripeAccountStatusLike = Pick<
  Stripe.Account,
  'charges_enabled' | 'details_submitted'
>

export function getStripeConnectOnboardingStatus(
  account: StripeAccountStatusLike | null | undefined,
): TenantStripeStatus {
  if (!account) return 'pending'

  // `charges_enabled` is Stripe's definitive signal that the account can accept
  // payments. Requirements with future deadlines, paused payouts, and pending
  // verifications do not affect this flag, so no additional checks are needed.
  if (account.charges_enabled === true) {
    return 'active'
  }

  // Details submitted but charges not yet enabled — account is in review or has
  // outstanding requirements that Stripe has actioned.
  if (account.charges_enabled === false) {
    return 'restricted'
  }

  return 'pending'
}

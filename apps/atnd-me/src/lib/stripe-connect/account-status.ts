import type Stripe from 'stripe'

import type { TenantStripeStatus } from '@/lib/stripe-connect/tenantStripe'

type StripeAccountStatusLike = Pick<
  Stripe.Account,
  'charges_enabled' | 'payouts_enabled' | 'details_submitted' | 'requirements'
>

export function getStripeConnectOnboardingStatus(
  account: StripeAccountStatusLike | null | undefined,
): TenantStripeStatus {
  if (!account) return 'pending'

  const requirements = account.requirements
  // Only requirements that are currently blocking charges or past their deadline.
  // `eventually_due` and `pending_verification` represent future deadlines or
  // in-progress reviews — they do not currently prevent the account from taking
  // payments, so they must not trigger restricted status.
  const hasBlockingRequirements = Boolean(
    requirements?.disabled_reason ||
      requirements?.currently_due?.length ||
      requirements?.past_due?.length,
  )

  // `payouts_enabled` being false means payouts are paused (e.g. documents needed
  // within a future deadline) but the account can still accept charges. Only gate
  // on `charges_enabled` so tenants can continue taking payments while they resolve
  // their payout verification requirements.
  if (
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !hasBlockingRequirements
  ) {
    return 'active'
  }

  if (account.details_submitted === true) {
    return 'restricted'
  }

  return 'pending'
}

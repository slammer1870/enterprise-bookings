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
  const hasOutstandingRequirements = Boolean(
    requirements?.disabled_reason ||
      requirements?.currently_due?.length ||
      requirements?.eventually_due?.length ||
      requirements?.past_due?.length ||
      requirements?.pending_verification?.length,
  )

  if (
    account.charges_enabled === true &&
    account.payouts_enabled === true &&
    account.details_submitted === true &&
    !hasOutstandingRequirements
  ) {
    return 'active'
  }

  if (account.details_submitted === true) {
    return 'restricted'
  }

  return 'pending'
}

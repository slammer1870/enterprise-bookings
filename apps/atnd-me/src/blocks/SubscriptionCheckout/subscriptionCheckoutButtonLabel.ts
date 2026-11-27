export type SubscriptionCheckoutButtonLabelParams = {
  isLoggedIn: boolean
  hasActiveSubscription: boolean
  isActivePlan: boolean
  isBusy: boolean
}

/** CTA copy for subscription checkout cards (subscribe / manage / upgrade / sign-in). */
export function subscriptionCheckoutButtonLabel(
  params: SubscriptionCheckoutButtonLabelParams,
): string {
  if (params.isBusy) {
    if (params.hasActiveSubscription && params.isActivePlan) return 'Opening portal…'
    if (params.hasActiveSubscription) return 'Updating subscription…'
    return 'Starting checkout…'
  }
  if (!params.isLoggedIn) return 'Sign in to subscribe'
  if (params.hasActiveSubscription && params.isActivePlan) return 'Manage my subscription'
  if (params.hasActiveSubscription) return 'Select this subscription'
  return 'Subscribe'
}

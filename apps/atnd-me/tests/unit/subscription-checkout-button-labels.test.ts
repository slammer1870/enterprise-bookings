import { describe, expect, it } from 'vitest'

import { subscriptionCheckoutButtonLabel } from '@/blocks/SubscriptionCheckout/subscriptionCheckoutButtonLabel'

describe('subscriptionCheckoutButtonLabel', () => {
  it('prompts unauthenticated users to sign in', () => {
    expect(
      subscriptionCheckoutButtonLabel({
        isLoggedIn: false,
        hasActiveSubscription: false,
        isActivePlan: false,
        isBusy: false,
      }),
    ).toBe('Sign in to subscribe')
  })

  it('shows Subscribe for logged-in users without a membership', () => {
    expect(
      subscriptionCheckoutButtonLabel({
        isLoggedIn: true,
        hasActiveSubscription: false,
        isActivePlan: false,
        isBusy: false,
      }),
    ).toBe('Subscribe')
  })

  it('shows Manage my subscription on the active plan', () => {
    expect(
      subscriptionCheckoutButtonLabel({
        isLoggedIn: true,
        hasActiveSubscription: true,
        isActivePlan: true,
        isBusy: false,
      }),
    ).toBe('Manage my subscription')
  })

  it('shows Select this subscription on other plans when subscribed', () => {
    expect(
      subscriptionCheckoutButtonLabel({
        isLoggedIn: true,
        hasActiveSubscription: true,
        isActivePlan: false,
        isBusy: false,
      }),
    ).toBe('Select this subscription')
  })

  it('shows Updating subscription while an upgrade is in progress', () => {
    expect(
      subscriptionCheckoutButtonLabel({
        isLoggedIn: true,
        hasActiveSubscription: true,
        isActivePlan: false,
        isBusy: true,
      }),
    ).toBe('Updating subscription…')
  })
})

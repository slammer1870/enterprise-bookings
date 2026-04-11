export type StripeConnectNotice = { tone: 'success' | 'error'; message: string } | null

export function getStripeConnectNoticeFromSearch(
  search: string,
  options?: { connected?: boolean | null },
): StripeConnectNotice {
  const searchParams = new URLSearchParams(search)
  const connectState = searchParams.get('stripe_connect')
  const rawMessage = searchParams.get('message')?.trim()

  if (connectState === 'success') {
    return {
      tone: 'success',
      message: options?.connected
        ? 'Stripe connected successfully.'
        : 'Stripe onboarding returned successfully. Final confirmation may take a moment.',
    }
  }

  if (connectState === 'error') {
    return {
      tone: 'error',
      message: rawMessage || 'Stripe onboarding could not be completed.',
    }
  }

  return null
}

/**
 * E2E/test Stripe Connect account ID prefixes.
 * When a tenant's stripeConnectAccountId matches one of these, we skip real Stripe API
 * calls and return mock responses (e.g. mock PaymentIntent client_secret) so tests
 * don't require real Connect accounts.
 */
const E2E_ACCOUNT_REGEX =
  /^acct_(fee_disclosure_|smoke_|cp_only_|dropin_discount_|e2e_connected_|e2e_gated_|leave_)/

/**
 * Returns true when the account ID is a known E2E/test placeholder (e.g. acct_cp_only_2).
 * Use this to avoid calling the real Stripe API in tests. Only matches our placeholder
 * prefixes; real Stripe test Connect accounts (e.g. acct_1234real) are not treated as test.
 */
export function isStripeTestAccount(accountId: string | null | undefined): boolean {
  const id = accountId?.trim()
  if (!id) return false
  return E2E_ACCOUNT_REGEX.test(id)
}

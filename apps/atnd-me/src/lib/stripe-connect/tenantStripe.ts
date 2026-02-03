/**
 * Tenant-aware Stripe Connect helpers (step 2.2).
 * No network calls; operates on tenant document shape.
 */

export type TenantStripeStatus =
  | 'not_connected'
  | 'pending'
  | 'active'
  | 'restricted'
  | 'deauthorized'

export type TenantStripeLike = {
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: TenantStripeStatus | null
}

export type TenantStripeContext = {
  isConnected: boolean
  accountId?: string
  requiresOnboarding: boolean
}

/** Typed error when tenant is not connected and a Connect account is required. */
export class TenantNotConnectedError extends Error {
  constructor(message = 'Tenant is not connected to Stripe Connect') {
    super(message)
    this.name = 'TenantNotConnectedError'
    Object.setPrototypeOf(this, TenantNotConnectedError.prototype)
  }
}

/**
 * Returns Stripe Connect context for a tenant from their doc fields.
 * - isConnected: true only when account id is set and status is 'active'.
 * - accountId: set when isConnected (for callers that need the id).
 * - requiresOnboarding: true when status is 'pending' or 'restricted'.
 */
export function getTenantStripeContext(tenant: TenantStripeLike): TenantStripeContext {
  const accountId = tenant.stripeConnectAccountId?.trim() || null
  const status = tenant.stripeConnectOnboardingStatus ?? 'not_connected'
  const isConnected = Boolean(accountId && status === 'active')
  const requiresOnboarding = status === 'pending' || status === 'restricted'
  return {
    isConnected,
    ...(isConnected ? { accountId: accountId! } : {}),
    requiresOnboarding,
  }
}

/**
 * Asserts the tenant has an active Stripe Connect account.
 * @throws TenantNotConnectedError when not connected (no account, pending, restricted, or deauthorized).
 */
export function requireTenantConnectAccount(tenant: TenantStripeLike): void {
  const ctx = getTenantStripeContext(tenant)
  if (!ctx.isConnected) {
    throw new TenantNotConnectedError()
  }
}

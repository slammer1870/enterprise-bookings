import { sanitizeFromAddress, sanitizeFromName } from '@/utilities/emailConfig'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export type TenantEmailFromInput = {
  tenantName?: string | null
  /** Website custom domain (tenants.domain), e.g. www.studio.example.com */
  tenantDomain?: string | null
  /** When true, From may use auth@{emailSendingDomain}. When false/undefined, platform default. */
  emailDomainVerified?: boolean | null
}

/**
 * Domain used for Resend verification + From addresses.
 * Strips a leading `www.` so website hosts like `www.boatyardsauna.ie` send as
 * `auth@boatyardsauna.ie` (not `auth@www.boatyardsauna.ie`).
 */
export function resolveEmailSendingDomain(websiteDomain: string | null | undefined): string | null {
  const normalized = websiteDomain ? normalizeCustomDomain(websiteDomain) : ''
  if (!normalized) return null
  if (normalized.startsWith('www.')) {
    const apex = normalized.slice('www.'.length)
    if (apex.includes('.')) return apex
  }
  return normalized
}

/**
 * Resolve Better Auth / transactional From for a tenant.
 * Only uses auth@{emailSendingDomain} when the Resend domain is verified.
 */
export function resolveTenantBasedBetterAuthFrom(args: TenantEmailFromInput) {
  const fromName = sanitizeFromName(args.tenantName) || 'ATND ME'
  const emailDomain = resolveEmailSendingDomain(args.tenantDomain)
  const useTenantDomain = Boolean(args.emailDomainVerified && emailDomain)
  const fromAddressEmail = useTenantDomain ? `auth@${emailDomain}` : 'auth@atnd.me'

  return {
    fromName,
    fromAddress: sanitizeFromAddress(fromAddressEmail) || 'auth@atnd.me',
  }
}

/** True when emailDomainStatus on the tenant doc allows custom From. */
export function isEmailDomainVerified(status: unknown): boolean {
  return status === 'verified'
}

/**
 * If `emailFrom` uses the tenant email sending domain (or www variant) but that
 * domain is not verified, return undefined so the Resend adapter default From is used.
 * Unrelated From domains are left as-is (existing 403 fallback still applies).
 */
export function sanitizeEmailFromForTenantDomain(args: {
  emailFrom?: string | null
  tenantDomain?: string | null
  emailDomainVerified?: boolean | null
}): string | undefined {
  const from = typeof args.emailFrom === 'string' ? args.emailFrom.trim() : ''
  if (!from) return undefined

  const websiteDomain = args.tenantDomain ? normalizeCustomDomain(args.tenantDomain) : null
  const emailDomain = resolveEmailSendingDomain(args.tenantDomain)
  if (!emailDomain && !websiteDomain) return from

  const match = from.match(/([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)/)
  const address = match?.[1]?.toLowerCase()
  if (!address || !address.includes('@')) return from

  const host = address.split('@')[1] || ''
  const hostIsTenantEmailDomain =
    host === emailDomain || host === websiteDomain || host === `www.${emailDomain}`
  if (hostIsTenantEmailDomain && !args.emailDomainVerified) {
    return undefined
  }
  return from
}

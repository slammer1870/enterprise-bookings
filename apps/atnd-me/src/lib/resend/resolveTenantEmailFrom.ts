import { sanitizeFromAddress, sanitizeFromName } from '@/utilities/emailConfig'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export type TenantEmailFromInput = {
  tenantName?: string | null
  tenantDomain?: string | null
  /** When true, From may use auth@{tenantDomain}. When false/undefined, platform default. */
  emailDomainVerified?: boolean | null
}

/**
 * Resolve Better Auth / transactional From for a tenant.
 * Only uses auth@{tenantDomain} when the Resend domain is verified.
 */
export function resolveTenantBasedBetterAuthFrom(args: TenantEmailFromInput) {
  const fromName = sanitizeFromName(args.tenantName) || 'ATND ME'
  const normalizedDomain = args.tenantDomain ? normalizeCustomDomain(args.tenantDomain) : null
  const useTenantDomain = Boolean(args.emailDomainVerified && normalizedDomain)
  const fromAddressEmail = useTenantDomain ? `auth@${normalizedDomain}` : 'auth@atnd.me'

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
 * If `emailFrom` uses the tenant custom domain but that domain is not verified,
 * return undefined so the Resend adapter default From is used.
 * Unrelated From domains are left as-is (existing 403 fallback still applies).
 */
export function sanitizeEmailFromForTenantDomain(args: {
  emailFrom?: string | null
  tenantDomain?: string | null
  emailDomainVerified?: boolean | null
}): string | undefined {
  const from = typeof args.emailFrom === 'string' ? args.emailFrom.trim() : ''
  if (!from) return undefined

  const tenantDomain = args.tenantDomain ? normalizeCustomDomain(args.tenantDomain) : null
  if (!tenantDomain) return from

  const match = from.match(/([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)/)
  const address = match?.[1]?.toLowerCase()
  if (!address || !address.includes('@')) return from

  const host = address.split('@')[1] || ''
  if (host === tenantDomain && !args.emailDomainVerified) {
    return undefined
  }
  return from
}

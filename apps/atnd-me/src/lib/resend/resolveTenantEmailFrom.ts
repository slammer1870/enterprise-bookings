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

/** True when From still contains unresolved `{{…}}` template placeholders. */
export function emailFromContainsTemplateVars(emailFrom: string): boolean {
  return /\{\{[\s\S]*?\}\}/.test(emailFrom)
}

function extractEmailHost(emailFrom: string): string | null {
  const match = emailFrom.match(/([^\s<>"']+@[^\s<>"']+\.[^\s<>"']+)/)
  const address = match?.[1]?.toLowerCase()
  if (!address || !address.includes('@')) return null
  return address.split('@')[1] || null
}

export function isHostTenantEmailDomain(
  host: string,
  tenantDomain: string | null | undefined,
): boolean {
  const websiteDomain = tenantDomain ? normalizeCustomDomain(tenantDomain) : null
  const emailDomain = resolveEmailSendingDomain(tenantDomain)
  if (!emailDomain && !websiteDomain) return false
  return host === emailDomain || host === websiteDomain || host === `www.${emailDomain}`
}

/**
 * Save-time / send-time rule for a literal Email From (no `{{…}}` templates).
 * Returns an error message, or null when the From is allowed.
 */
export function getEmailFromTenantDomainValidationError(args: {
  emailFrom?: string | null
  tenantDomain?: string | null
  emailDomainVerified?: boolean | null
}): string | null {
  const from = typeof args.emailFrom === 'string' ? args.emailFrom.trim() : ''
  if (!from) return null
  if (emailFromContainsTemplateVars(from)) return null

  const emailDomain = resolveEmailSendingDomain(args.tenantDomain)
  if (!args.emailDomainVerified || !emailDomain) {
    return 'Verify your studio email domain before setting a custom Email From address.'
  }

  const host = extractEmailHost(from)
  if (!host) {
    return 'Email From must include a valid email address (e.g. hello@your-domain.com).'
  }

  if (!isHostTenantEmailDomain(host, args.tenantDomain)) {
    return `Email From must use your verified domain (${emailDomain}).`
  }

  return null
}

/**
 * Allow a custom From only when its host is this tenant's email-sending domain
 * (or www / website-host variant) and that domain is verified for the tenant.
 * Otherwise return undefined so the Resend adapter default From is used.
 *
 * This blocks cross-tenant spoofing on a shared Resend account: tenant A cannot
 * send as tenant B's verified domain.
 */
export function sanitizeEmailFromForTenantDomain(args: {
  emailFrom?: string | null
  tenantDomain?: string | null
  emailDomainVerified?: boolean | null
}): string | undefined {
  const from = typeof args.emailFrom === 'string' ? args.emailFrom.trim() : ''
  if (!from) return undefined
  if (getEmailFromTenantDomainValidationError(args)) return undefined
  return from
}

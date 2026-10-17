import { sanitizeFromAddress, sanitizeFromName } from '@/utilities/emailConfig'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'
import {
  canonicalHostForEmail,
  resolveEmailSendingDomain,
  type EmailSendingDomainSource,
} from './emailSendingDomain'

export { resolveEmailSendingDomain, type EmailSendingDomainSource } from './emailSendingDomain'

export type TenantEmailFromInput = {
  tenantName?: string | null
  /** A single host, used when the caller has not passed a hostname list. */
  tenantDomain?: string | null
  hostnames?: unknown
  direction?: unknown
  slug?: string | null
  /** When true, From may use auth@{emailSendingDomain}. When false/undefined, platform default. */
  emailDomainVerified?: boolean | null
}

function emailSource(args: {
  tenantDomain?: string | null
  hostnames?: unknown
  direction?: unknown
  slug?: string | null
}): EmailSendingDomainSource | string | null | undefined {
  if (args.hostnames === undefined && args.direction === undefined && args.slug === undefined) {
    return args.tenantDomain
  }
  return {
    hostnames: args.hostnames,
    direction: args.direction,
    slug: args.slug,
  }
}

/**
 * Resolve Better Auth / transactional From for a tenant.
 * Only uses auth@{emailSendingDomain} when the Resend domain is verified.
 */
export function resolveTenantBasedBetterAuthFrom(args: TenantEmailFromInput) {
  const fromName = sanitizeFromName(args.tenantName) || 'ATND ME'
  const emailDomain = resolveEmailSendingDomain(emailSource(args))
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
  source: EmailSendingDomainSource | string | null | undefined,
): boolean {
  const websiteDomain = canonicalHostForEmail(source)
  const normalizedWebsite = websiteDomain ? normalizeCustomDomain(websiteDomain) : null
  const emailDomain = resolveEmailSendingDomain(source)
  if (!emailDomain && !normalizedWebsite) return false
  return host === emailDomain || host === normalizedWebsite || host === `www.${emailDomain}`
}

/**
 * Save-time / send-time rule for a literal Email From (no `{{…}}` templates).
 * Returns an error message, or null when the From is allowed.
 */
export function getEmailFromTenantDomainValidationError(args: {
  emailFrom?: string | null
  tenantDomain?: string | null
  hostnames?: unknown
  direction?: unknown
  slug?: string | null
  emailDomainVerified?: boolean | null
}): string | null {
  const from = typeof args.emailFrom === 'string' ? args.emailFrom.trim() : ''
  if (!from) return null
  if (emailFromContainsTemplateVars(from)) return null

  const source = emailSource(args)
  const emailDomain = resolveEmailSendingDomain(source)
  if (!args.emailDomainVerified || !emailDomain) {
    return 'Verify your studio email domain before setting a custom Email From address.'
  }

  const host = extractEmailHost(from)
  if (!host) {
    return 'Email From must include a valid email address (e.g. hello@your-domain.com).'
  }

  if (!isHostTenantEmailDomain(host, source)) {
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
  hostnames?: unknown
  direction?: unknown
  slug?: string | null
  emailDomainVerified?: boolean | null
}): string | undefined {
  const from = typeof args.emailFrom === 'string' ? args.emailFrom.trim() : ''
  if (!from) return undefined
  if (getEmailFromTenantDomainValidationError(args)) return undefined
  return from
}

import { normalizeAndValidateTenantSlugFormat } from '@repo/shared-utils'

/** Reserved tenant slugs that must never be claimable. */
export const RESERVED_TENANT_SLUGS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'mail',
  'status',
  'static',
  'assets',
  'cdn',
  'help',
  'support',
  'docs',
  'blog',
  'auth',
  'login',
  'signup',
  'onboard',
  'onboarding',
  'dashboard',
  'billing',
  'stripe',
  'webhook',
  'webhooks',
  'test',
  'staging',
  'prod',
  'production',
  'localhost',
  'null',
  'undefined',
])

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

/**
 * Normalize and validate a tenant username/slug for self-serve claim.
 * Must be a valid DNS subdomain label and not reserved.
 */
export function normalizeAndValidateTenantSlug(raw: unknown): SlugValidationResult {
  const format = normalizeAndValidateTenantSlugFormat(raw)
  if (!format.ok) return format

  if (RESERVED_TENANT_SLUGS.has(format.slug)) {
    return { ok: false, error: 'This username is reserved' }
  }

  return { ok: true, slug: format.slug }
}

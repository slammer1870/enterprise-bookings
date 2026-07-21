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

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

/**
 * Normalize and validate a tenant username/slug for self-serve claim.
 * Rules: lowercase alphanumeric + hyphens, 2–48 chars, no leading/trailing hyphen, not reserved.
 */
export function normalizeAndValidateTenantSlug(raw: unknown): SlugValidationResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Username is required' }
  }

  const slug = raw.trim().toLowerCase()

  if (!slug) {
    return { ok: false, error: 'Username is required' }
  }

  if (slug.length < 2) {
    return { ok: false, error: 'Username must be at least 2 characters' }
  }

  if (slug.length > 48) {
    return { ok: false, error: 'Username must be at most 48 characters' }
  }

  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: 'Username may only contain lowercase letters, numbers, and hyphens',
    }
  }

  if (RESERVED_TENANT_SLUGS.has(slug)) {
    return { ok: false, error: 'This username is reserved' }
  }

  return { ok: true, slug }
}

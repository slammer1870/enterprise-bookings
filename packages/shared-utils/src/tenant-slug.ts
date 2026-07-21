/**
 * Tenant username / subdomain label rules (RFC 1123 DNS label subset).
 * Lowercase letters, digits, hyphens; 2–48 chars; no leading/trailing or consecutive hyphens.
 */

export const TENANT_SLUG_MIN_LENGTH = 2
export const TENANT_SLUG_MAX_LENGTH = 48

/** Full valid slug once complete (not while mid-typing a trailing hyphen). */
export const TENANT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/

export type TenantSlugFormatResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

/**
 * Live input sanitizer for username/subdomain fields.
 * Lowercases, maps spaces/underscores to hyphens, drops other characters,
 * collapses `--`, and strips leading hyphens (invalid for DNS labels).
 */
export function sanitizeTenantSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
}

/**
 * Normalize and validate a value as a DNS subdomain label suitable for `{slug}.platform`.
 */
export function normalizeAndValidateTenantSlugFormat(raw: unknown): TenantSlugFormatResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Username is required' }
  }

  const slug = sanitizeTenantSlugInput(raw)

  if (!slug) {
    return { ok: false, error: 'Username is required' }
  }

  if (slug.length < TENANT_SLUG_MIN_LENGTH) {
    return { ok: false, error: 'Username must be at least 2 characters' }
  }

  if (slug.length > TENANT_SLUG_MAX_LENGTH) {
    return { ok: false, error: 'Username must be at most 48 characters' }
  }

  if (slug.endsWith('-')) {
    return {
      ok: false,
      error: 'Username cannot start or end with a hyphen',
    }
  }

  if (slug.includes('--')) {
    return {
      ok: false,
      error: 'Username cannot contain consecutive hyphens',
    }
  }

  if (slug.startsWith('xn--')) {
    return { ok: false, error: 'Username format is invalid' }
  }

  if (!TENANT_SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        'Username must be a valid subdomain: lowercase letters, numbers, and single hyphens only',
    }
  }

  return { ok: true, slug }
}

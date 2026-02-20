/**
 * Validation and normalization for tenant custom domains.
 * Used when tenants set a custom domain (e.g. studio.example.com) so the app
 * can resolve tenant from Host and set trusted origins for auth.
 */

import dns from 'node:dns/promises'

/** Max length for a full hostname (RFC 2535). */
const MAX_HOSTNAME_LENGTH = 253

/** Timeout for DNS lookups (ms). Prevents hanging when DNS is slow or blocked. */
const DNS_LOOKUP_TIMEOUT_MS = 8000

/** Regex: valid hostname label (one part between dots). Letters, digits, hyphens; no leading/trailing hyphen. */
const LABEL_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

/**
 * Returns the root hostname from NEXT_PUBLIC_SERVER_URL (e.g. atnd-me.com).
 * Used to reject custom domains that would conflict with the platform.
 */
export function getPlatformRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Normalizes a custom domain for storage: trim, lowercase, remove port if present.
 * Does not validate; use validateCustomDomainFormat for that.
 */
export function normalizeCustomDomain(value: string): string {
  let s = value.trim().toLowerCase()
  const portIdx = s.indexOf(':')
  if (portIdx !== -1) {
    s = s.slice(0, portIdx)
  }
  return s.trim()
}

/**
 * Validates custom domain format only (no DB or platform checks).
 * - Empty is valid (optional field).
 * - Must be a valid hostname: labels separated by dots, each label [a-z0-9] with optional hyphens.
 * - No protocol, path, or leading/trailing dots.
 *
 * @returns true if valid, or an error message string.
 */
export function validateCustomDomainFormat(
  value: string | null | undefined
): true | string {
  if (value == null || value === '') return true

  const s = value.trim()
  if (s === '') return true

  if (s.length > MAX_HOSTNAME_LENGTH) {
    return `Custom domain must be at most ${MAX_HOSTNAME_LENGTH} characters.`
  }

  if (s.includes('://') || s.includes('/')) {
    return 'Enter only the hostname (e.g. studio.example.com), without protocol or path.'
  }

  if (s.startsWith('.') || s.endsWith('.')) {
    return 'Hostname must not start or end with a dot.'
  }

  const labels = s.split('.')
  if (labels.some((l) => l.length === 0)) {
    return 'Hostname must not have empty labels (e.g. no consecutive dots).'
  }

  if (labels.some((l) => l.length > 63)) {
    return 'Each part of the hostname must be at most 63 characters.'
  }

  if (!labels.every((l) => LABEL_REGEX.test(l))) {
    return 'Hostname can only contain letters, numbers, and hyphens; hyphens cannot start or end a part.'
  }

  if (labels.length < 2) {
    return 'Custom domain should be a full hostname with at least two parts (e.g. studio.example.com).'
  }

  if (s === 'localhost' || s.endsWith('.localhost')) {
    return 'Cannot use localhost as a custom domain. Use the tenant subdomain in development.'
  }

  return true
}

/**
 * Validates that the custom domain is not the platform's root hostname or a subdomain of it.
 * Call this in hooks when you have the normalized value.
 *
 * @returns true if allowed, or an error message string.
 */
export function validateCustomDomainNotPlatform(
  normalizedHostname: string
): true | string {
  const root = getPlatformRootHostname()
  if (!root) return true

  if (normalizedHostname === root) {
    return `Cannot use the platform domain (${root}) as a custom domain.`
  }

  if (normalizedHostname.endsWith('.' + root)) {
    return `Cannot use a subdomain of the platform (${root}) as a custom domain. Use the tenant subdomain instead.`
  }

  return true
}

/**
 * When true, tenant custom domain saves require the domain to have DNS records (A, AAAA, or CNAME).
 * Set to "true" in production to avoid saving domains that don't resolve yet.
 * Leave unset or "false" in local dev so tenants can be saved before DNS is configured.
 */
export function isCustomDomainDnsValidationEnabled(): boolean {
  return process.env.VALIDATE_TENANT_CUSTOM_DOMAIN_DNS === 'true'
}

/**
 * Checks that the hostname has DNS records (A, AAAA, or CNAME).
 * Uses Node's dns.promises with a timeout to avoid hanging.
 *
 * @param hostname - Normalized hostname (e.g. studio.example.com)
 * @returns Promise resolving to true if DNS records exist, or an error message string.
 */
export async function validateCustomDomainDns(
  hostname: string
): Promise<true | string> {
  const timeout = new Promise<true | string>((_, reject) =>
    setTimeout(
      () => reject(new Error('DNS lookup timed out')),
      DNS_LOOKUP_TIMEOUT_MS
    )
  )

  const lookup = async (): Promise<true | string> => {
    try {
      await dns.lookup(hostname, { all: false })
      return true
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : null
      if (code === 'ENOTFOUND' || code === 'ETIMEOUT') {
        return `Domain "${hostname}" has no A or AAAA records. Add a DNS A, AAAA, or CNAME record pointing to your app before saving.`
      }
      if (code === 'ENODATA') {
        return `Domain "${hostname}" has no DNS records. Configure DNS (A, AAAA, or CNAME) for this domain before saving.`
      }
      return `Domain "${hostname}" could not be verified (${code ?? String(err)}). Check DNS and try again.`
    }
  }

  try {
    return await Promise.race([lookup(), timeout])
  } catch (e) {
    return `Domain "${hostname}" could not be verified: DNS lookup timed out. Check DNS and try again.`
  }
}

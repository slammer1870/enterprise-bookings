import {
  canonicalHostFromList,
  getClaimedApex,
  parseDirection,
} from '@/utilities/hostnameDirection'

/**
 * What the email sending domain is read from.
 * A saved hostname list (including an empty one) supplies the canonical host.
 * `domain` is the legacy custom domain, used only when that list has not been saved.
 */
export type EmailSendingDomainSource = {
  hostnames?: unknown
  direction?: unknown
  slug?: unknown
  domain?: unknown
}

/** Apex of the platform host in NEXT_PUBLIC_SERVER_URL. Null when that URL is unset. */
export function platformEmailApex(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    const root = new URL(url).hostname.toLowerCase()
    return root ? getClaimedApex(root) : null
  } catch {
    return null
  }
}

export function isPlatformEmailApex(domain: string): boolean {
  const apex = platformEmailApex()
  return Boolean(apex && domain === apex)
}

function normalizeHost(value: string): string {
  let s = value.trim().toLowerCase()
  const portIdx = s.indexOf(':')
  if (portIdx !== -1) s = s.slice(0, portIdx)
  return s.trim()
}

/** Null means the hostname list has not been saved. An array, including empty, has. */
function savedHostnames(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const host of value) {
    if (host == null) continue
    const normalized = normalizeHost(String(host))
    if (normalized) out.push(normalized)
  }
  return out
}

function platformSubdomain(slug: unknown): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url || typeof slug !== 'string') return null
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) return null
  try {
    const root = new URL(url).hostname.toLowerCase()
    if (!root) return null
    return `${normalizedSlug}.${root}`
  } catch {
    return null
  }
}

/** Host whose apex is the email sending domain. */
export function canonicalHostForEmail(
  source: EmailSendingDomainSource | string | null | undefined,
): string | null {
  if (typeof source === 'string') {
    const host = normalizeHost(source)
    return host || null
  }
  if (source == null) return null

  const hostnames = savedHostnames(source.hostnames)
  if (hostnames !== null) {
    if (hostnames.length === 0) return platformSubdomain(source.slug)
    return canonicalHostFromList(hostnames, parseDirection(source.direction)) || null
  }

  const domain = typeof source.domain === 'string' ? normalizeHost(source.domain) : ''
  if (domain) return domain
  return platformSubdomain(source.slug)
}

/**
 * Email sending domain: the apex of the canonical host.
 * A string is that host. With no custom hostname, this is the platform apex.
 */
export function resolveEmailSendingDomain(
  source: EmailSendingDomainSource | string | null | undefined,
): string | null {
  const canonical = canonicalHostForEmail(source)
  if (!canonical) return null
  return getClaimedApex(canonical)
}

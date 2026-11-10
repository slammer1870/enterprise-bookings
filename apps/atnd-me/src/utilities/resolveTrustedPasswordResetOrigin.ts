import type { Payload } from 'payload'

import { namedHostnameIsAllowed } from '@/lib/tenantDbResolve'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'
import {
  getPlatformHostname,
  getRequestOrigin,
  getServerSideURL,
} from '@/utilities/getURL'

type HeadersLike = Pick<Headers, 'get'>

type PayloadFind = {
  // Loose Local API shape so callers can pass `req.payload` without slug generics.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  find: (args: any) => Promise<{ docs: unknown[] }>
  db?: unknown
}

function platformOrigin(): string {
  try {
    return new URL(getServerSideURL()).origin
  } catch {
    return getServerSideURL().replace(/\/$/, '')
  }
}

function isTrustedPlatformHost(hostname: string, platformHost: string): boolean {
  if (!hostname || !platformHost) return false
  if (hostname === platformHost) return true

  // Local multi-tenant: {slug}.localhost
  if (platformHost === 'localhost' || platformHost.endsWith('.localhost')) {
    return hostname.endsWith('.localhost')
  }

  // Platform subdomain: {slug}.{platformHost}
  return hostname.endsWith('.' + platformHost)
}

/**
 * Resolve an absolute origin for admin password-reset email links.
 *
 * Trusts:
 * - platform host (NEXT_PUBLIC_SERVER_URL)
 * - platform subdomains / *.localhost (DNS we control)
 * - tenant custom domains that exist in the tenants collection
 *
 * Anything else falls back to the platform origin (prevents Host-header injection).
 */
export async function resolveTrustedPasswordResetOrigin(args: {
  headers?: HeadersLike | null
  payload?: PayloadFind | null
}): Promise<string> {
  const fallback = platformOrigin()
  const hostHeader =
    args.headers?.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    args.headers?.get('host')?.trim()

  if (!hostHeader) return fallback

  let candidate: URL
  try {
    candidate = new URL(getRequestOrigin(args.headers))
  } catch {
    return fallback
  }

  const hostname = candidate.hostname.toLowerCase()
  const platformHost = getPlatformHostname()?.toLowerCase() || ''

  if (isTrustedPlatformHost(hostname, platformHost)) {
    return candidate.origin
  }

  const normalized = normalizeCustomDomain(hostname)
  if (!normalized || !args.payload) return fallback

  try {
    const allowed = await namedHostnameIsAllowed(args.payload as Payload, normalized)
    if (allowed) return candidate.origin
  } catch {
    // Fail closed to platform origin
  }

  return fallback
}

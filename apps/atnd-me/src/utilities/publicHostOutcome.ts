import { getServerSideURL } from '@/utilities/getURL'
import {
  isBaseHostRequest,
  isPlatformMarketingHostname,
  type CookiesLike,
} from '@/utilities/tenantRequest'

/** Set by middleware when the public host is unknown or lookup failed. */
export const PUBLIC_HOST_OUTCOME_HEADER = 'x-public-host-outcome' as const

export type PublicHostOutcome = 'unknown' | 'failed'

export const E2E_FORCE_HOST_LOOKUP_FAILURE_HEADER = 'x-e2e-force-host-lookup-failure' as const

const SEO_ERROR_PATHS = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/pages-sitemap.xml',
  '/posts-sitemap.xml',
])

export function isSeoErrorPath(pathname: string): boolean {
  if (SEO_ERROR_PATHS.has(pathname)) return true
  return pathname.startsWith('/sitemap')
}

type HeadersLike = { get?: (name: string) => string | null }

/**
 * Hostnames where the platform marketing site is served and the platform mark may appear.
 * Tenant subdomains and custom domains are never platform public hosts.
 */
export function isPlatformPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0] ?? hostname.toLowerCase()

  if (normalized === 'localhost' || normalized === '127.0.0.1') return true

  const headers = new Headers({ host: normalized })
  if (isBaseHostRequest(headers)) return true
  if (isPlatformMarketingHostname(normalized)) return true

  return false
}

function configuredRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isCustomPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().split(':')[0] ?? hostname.toLowerCase()
  const rootHostname = configuredRootHostname()
  if (!rootHostname || normalized.includes('localhost')) return false
  if (normalized === rootHostname || normalized.endsWith(`.${rootHostname}`)) return false

  return true
}

export function platformSubdomainSlug(hostname: string): string | null {
  const normalized = hostname.toLowerCase().split(':')[0] ?? hostname.toLowerCase()
  const isLocalhost = normalized.includes('localhost')
  const parts = normalized.split('.')
  const rootHostname = configuredRootHostname()

  if (isLocalhost) {
    if (parts.length > 1 && parts[0] && parts[0] !== 'localhost') return parts[0]
    return null
  }

  if (rootHostname) {
    if (normalized === rootHostname || !normalized.endsWith('.' + rootHostname)) return null
    const prefix = normalized.slice(0, -(rootHostname.length + 1))
    return prefix.split('.')[0] || null
  }

  if (parts.length >= 3 && parts[0]) return parts[0]
  return null
}

export function readPublicHostOutcome(headers?: HeadersLike | Headers | null): PublicHostOutcome | null {
  const value = headers?.get?.(PUBLIC_HOST_OUTCOME_HEADER)?.trim().toLowerCase()
  if (value === 'unknown' || value === 'failed') return value
  return null
}

export function publicHostErrorMetadata(outcome: PublicHostOutcome): {
  title: string
  robots: { index: false; follow: false }
  icons?: undefined
} {
  return {
    title: outcome === 'unknown' ? 'Not found' : 'Unavailable',
    robots: { index: false, follow: false },
    icons: undefined,
  }
}

export function publicHostErrorHtml(outcome: PublicHostOutcome): string {
  const title = outcome === 'unknown' ? 'Not found' : 'Unavailable'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="robots" content="noindex">
</head>
<body>
<h1>${title}</h1>
</body>
</html>`
}

export function publicHostErrorResponse(outcome: PublicHostOutcome): Response {
  const status = outcome === 'unknown' ? 404 : 503
  return new Response(publicHostErrorHtml(outcome), {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      [PUBLIC_HOST_OUTCOME_HEADER]: outcome,
      'cache-control': 'no-store',
    },
  })
}

export type TenantHostLookupResult =
  | { status: 'ok'; data: Record<string, unknown> | null }
  | { status: 'unknown' }
  | { status: 'failed' }

export function shouldForwardForceLookupFailure(
  requestHeaders: HeadersLike | Headers | null | undefined,
): boolean {
  return requestHeaders?.get?.(E2E_FORCE_HOST_LOOKUP_FAILURE_HEADER) === '1'
}

export function internalTenantLookupHeaders(args: {
  hostname?: string
  extra?: Record<string, string>
  forwardForceFailure?: boolean
  requestHeaders?: HeadersLike | Headers | null
}): Record<string, string> | undefined {
  const headers: Record<string, string> = args.extra ? { ...args.extra } : {}
  const token = process.env.INTERNAL_TENANT_RESOLVE_TOKEN
  if (token) headers['x-internal-tenant-resolve'] = token
  if (args.hostname) headers['x-resolve-host'] = args.hostname
  if (args.forwardForceFailure && shouldForwardForceLookupFailure(args.requestHeaders)) {
    headers[E2E_FORCE_HOST_LOOKUP_FAILURE_HEADER] = '1'
  }
  return Object.keys(headers).length > 0 ? headers : undefined
}

export function getPlatformOrigin(): string | null {
  try {
    return new URL(getServerSideURL()).origin
  } catch {
    return null
  }
}

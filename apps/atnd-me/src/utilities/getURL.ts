import canUseDOM from './canUseDOM'
import {
  getTenantPlatformSubdomain,
  readHostnameDeclaration,
} from './tenantPublicHostDeclaration'

export const getServerSideURL = () => {
  return (
    process.env.NEXT_PUBLIC_SERVER_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')
  )
}

type HeadersLike = Pick<Headers, 'get'>

export type TenantURLSource = {
  slug?: string | null
  hostnames?: unknown
  direction?: unknown
}

/** Canonical host derived from the hostname list and Direction. */
const canonicalHostFromDeclaration = (tenant?: TenantURLSource | null): string | null => {
  if (!tenant) return null
  const canonical = readHostnameDeclaration(tenant).roles.canonicalHost.trim()
  return canonical || null
}

const getPlatformURL = () => getServerSideURL()

export const getPlatformHostname = () => {
  try {
    return new URL(getPlatformURL()).hostname
  } catch {
    return null
  }
}

const getPlatformPort = () => {
  try {
    return new URL(getPlatformURL()).port
  } catch {
    return ''
  }
}

const getPlatformProtocol = () => {
  try {
    return new URL(getPlatformURL()).protocol.replace(/:$/, '')
  } catch {
    return 'https'
  }
}

export const getProtocolFromHeaders = (headers?: HeadersLike | null) => {
  const forwardedProto = headers?.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedProto) return forwardedProto

  return getPlatformProtocol()
}

export const getRequestOrigin = (headers?: HeadersLike | null) => {
  const host =
    headers?.get('x-forwarded-host')?.split(',')[0]?.trim() || headers?.get('host')?.trim()

  if (!host) {
    return getPlatformURL()
  }

  return `${getProtocolFromHeaders(headers)}://${host}`
}

export const getTenantSubdomainURL = (slug: string, headers?: HeadersLike | null) => {
  const platformHostname = getPlatformHostname()
  if (!platformHostname) return getPlatformURL()

  const protocol = getProtocolFromHeaders(headers)
  const requestHost =
    headers?.get('x-forwarded-host')?.split(',')[0]?.trim() || headers?.get('host')?.trim() || ''
  const requestPort = requestHost.includes(':') ? requestHost.split(':')[1] || '' : ''
  const port = requestPort || getPlatformPort()

  if (platformHostname.includes('localhost')) {
    return `${protocol}://${slug}.${platformHostname}${port ? `:${port}` : ''}`
  }

  return `${protocol}://${slug}.${platformHostname}`
}

export const getTenantSiteURL = (
  tenant?: TenantURLSource | null,
  headers?: HeadersLike | null,
) => {
  const canonicalHost = canonicalHostFromDeclaration(tenant)
  if (canonicalHost) {
    const slug = tenant?.slug?.trim()
    if (slug) {
      const platformHost = getTenantPlatformSubdomain(slug)
      if (platformHost && canonicalHost === platformHost) {
        return getTenantSubdomainURL(slug, headers)
      }
    }
    const protocol = canonicalHost.includes('localhost') ? 'http' : getProtocolFromHeaders(headers)
    return `${protocol}://${canonicalHost}`
  }

  const slug = tenant?.slug?.trim()
  if (slug) {
    return getTenantSubdomainURL(slug, headers)
  }

  return getPlatformURL()
}

/**
 * Host search engines should index. The hostname list supplies the canonical host.
 * With no custom hostname, that is the platform subdomain.
 */
export const getCanonicalHostname = (tenant?: TenantURLSource | null): string | null => {
  const canonicalHost = canonicalHostFromDeclaration(tenant)
  if (canonicalHost) return canonicalHost

  const slug = tenant?.slug?.trim()
  const platformHostname = getPlatformHostname()
  if (!slug || !platformHostname) return null

  return `${slug}.${platformHostname}`
}

/**
 * Indexed URL: `https://<canonical host><path>`, with no query and no port.
 * `path` is the request path.
 */
export const getIndexedURL = (canonicalHostname: string, path: string): string => {
  const withoutQuery = path.split('?')[0] ?? '/'
  const requestPath = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  return `https://${canonicalHostname}${requestPath}`
}

export const getAbsoluteURL = (pathname: string, baseURL: string) => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return new URL(normalizedPath, baseURL).toString()
}

export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ''
}

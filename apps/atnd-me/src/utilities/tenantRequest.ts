import { getPlatformHostname } from './getURL'

type HeadersLike = {
  get?: (name: string) => string | null
}

type CookiesLike = {
  get?: (name: string) => { value?: string } | undefined
}

type TenantRequestSource = {
  cookies?: CookiesLike
  headers?: HeadersLike | Headers | null
  searchParams?: URLSearchParams
}

type TenantIdentifierOptions = {
  allowNumericHeaderId?: boolean
}

export function getRequestHostname(headers?: HeadersLike | Headers | null): string | null {
  const host =
    headers?.get?.('x-forwarded-host')?.split(',')[0]?.trim() || headers?.get?.('host')?.trim() || ''
  if (!host) return null
  return host.split(':')[0] ?? host
}

/**
 * Hostname for "is this the platform root site?" checks.
 * Prefer `Host` over `x-forwarded-host` so a mis-set forwarded header (e.g. platform apex)
 * does not hide a tenant custom domain on `Host` (common behind some proxies).
 */
function getHostnameForBaseHostCheck(headers?: HeadersLike | Headers | null): string | null {
  const fromHost = headers?.get?.('host')?.trim() || ''
  const fromForwarded = headers?.get?.('x-forwarded-host')?.split(',')[0]?.trim() || ''
  const raw = fromHost || fromForwarded
  if (!raw) return null
  return raw.split(':')[0] ?? raw
}

export function isBaseHostRequest(headers?: HeadersLike | Headers | null): boolean {
  const hostname = getHostnameForBaseHostCheck(headers)
  if (!hostname) return false

  if (hostname === 'localhost' || hostname === '127.0.0.1') return true

  const platformHostname = getPlatformHostname()
  return Boolean(platformHostname && hostname === platformHostname)
}

export function getTenantSlugFromHost(headers?: HeadersLike | Headers | null): string | null {
  const hostname = getRequestHostname(headers)
  if (!hostname) return null

  const platformHostname = getPlatformHostname()

  if (hostname.includes('localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1 && parts[0] && parts[0] !== 'localhost') {
      return parts[0]
    }
    return null
  }

  if (!platformHostname || hostname === platformHostname) {
    return null
  }

  if (hostname.endsWith(`.${platformHostname}`)) {
    const prefix = hostname.slice(0, -(platformHostname.length + 1))
    return prefix.split('.')[0] || null
  }

  return null
}

export function getTenantSlugFromRequest(source?: TenantRequestSource | null): string | null {
  if (!source) return null

  const cookieValue = source.cookies?.get?.('tenant-slug')?.value?.trim()
  // Ignore stale tenant-slug cookies on the platform root host. Root-host requests should only
  // derive tenant context from explicit headers/params or the actual request hostname.
  if (cookieValue && !isBaseHostRequest(source.headers)) return cookieValue

  const headerValue = source.headers?.get?.('x-tenant-slug')?.trim()
  if (headerValue) return headerValue

  const paramValue = source.searchParams?.get?.('slug')?.trim()
  if (paramValue) return paramValue

  return getTenantSlugFromHost(source.headers)
}

export function getPayloadTenantIdFromRequest(source?: TenantRequestSource | null): number | null {
  const raw = source?.cookies?.get?.('payload-tenant')?.value?.trim()
  if (!raw || !/^\d+$/.test(raw)) return null

  const id = parseInt(raw, 10)
  return Number.isFinite(id) ? id : null
}

/**
 * Ordered hostnames to try for custom-domain tenant lookup (forwarded + Host).
 * Helps when `x-forwarded-host` points at the platform but `Host` is the tenant custom domain.
 */
export function collectTenantLookupHostnames(headers?: HeadersLike | Headers | null): string[] {
  if (!headers || typeof headers.get !== 'function') return []
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = headers.get('host')?.trim()
  const out: string[] = []
  for (const h of [forwarded, host]) {
    if (!h) continue
    const hostname = h.split(':')[0]?.trim()
    if (hostname && !out.includes(hostname)) {
      out.push(hostname)
    }
  }
  return out
}

export function getTenantIdentifierFromRequest(
  source?: TenantRequestSource | null,
  options?: TenantIdentifierOptions,
): string | null {
  if (!source) return null

  if (options?.allowNumericHeaderId) {
    const numericHeaderId = source.headers?.get?.('x-tenant-id')?.trim()
    if (numericHeaderId) return numericHeaderId
  }

  const slug = getTenantSlugFromRequest(source)
  if (slug) return slug

  const searchTenantSlug = source.searchParams?.get?.('tenantSlug')?.trim()
  if (searchTenantSlug) return searchTenantSlug

  return null
}

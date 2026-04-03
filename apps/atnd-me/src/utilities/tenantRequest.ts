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

export function isBaseHostRequest(headers?: HeadersLike | Headers | null): boolean {
  const hostname = getRequestHostname(headers)
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
  if (cookieValue) return cookieValue

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

const PAYLOAD_TENANT_COOKIE = 'payload-tenant'
const COOKIE_MAX_AGE_YEAR = 60 * 60 * 24 * 365

/**
 * Default cookie domain for payload-tenant when admin is on subdomain.
 * Uses NEXT_PUBLIC_SERVER_URL and window.location.hostname. Apps can override via context if needed.
 */
export function getPayloadTenantCookieDomainDefault(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
  if (!serverUrl) return undefined
  try {
    const rootHostname = new URL(serverUrl).hostname
    const current = window.location.hostname
    if (current === rootHostname) return undefined
    if (rootHostname === 'localhost') {
      if (current.endsWith('.localhost')) return '.localhost'
      return undefined
    }
    if (current.endsWith('.' + rootHostname)) return `.${rootHostname}`
    return undefined
  } catch {
    return undefined
  }
}

export function setPayloadTenantCookie(
  tenantId: string | undefined,
  getCookieDomain?: () => string | undefined,
): void {
  if (typeof document === 'undefined') return
  const encoded = tenantId != null && tenantId !== '' ? encodeURIComponent(tenantId) : ''
  const isSet = encoded !== ''
  const domain = getCookieDomain?.() ?? getPayloadTenantCookieDomainDefault()
  const domainAttr = domain ? `; Domain=${domain}` : ''
  const baseAttrs = `SameSite=Lax${domainAttr}`
  const maxAgeAttrs = isSet ? `Max-Age=${COOKIE_MAX_AGE_YEAR}` : `Max-Age=0`
  const base = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/; ${maxAgeAttrs}; ${baseAttrs}`
  document.cookie = base
  document.cookie = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/admin; ${maxAgeAttrs}; ${baseAttrs}`
  document.cookie = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/admin/; ${maxAgeAttrs}; ${baseAttrs}`
}

export function deleteTenantCookie(getCookieDomain?: () => string | undefined): void {
  if (typeof document === 'undefined') return
  const domain = getCookieDomain?.() ?? getPayloadTenantCookieDomainDefault()
  const domainAttr = domain ? `; Domain=${domain}` : ''
  const base = `${PAYLOAD_TENANT_COOKIE}=; Max-Age=0; SameSite=Lax${domainAttr}`
  document.cookie = `${base}; Path=/`
  document.cookie = `${base}; Path=/admin`
  document.cookie = `${base}; Path=/admin/`
}

export function getTenantCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${PAYLOAD_TENANT_COOKIE}=([^;]*)`))
  return match?.[1] != null ? decodeURIComponent(match[1]) : undefined
}

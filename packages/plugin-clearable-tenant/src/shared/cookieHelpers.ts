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

  // Ensure there is only ONE payload-tenant cookie entry:
  // - no duplicates across path (/, /admin, /admin/)
  // - no duplicates across host-only vs domain-scoped
  //
  // Canonical cookie is always Path=/, optionally Domain=... when provided.
  const domainsToClear = [undefined, domain].filter(
    (d, idx, arr) => arr.indexOf(d) === idx,
  ) as Array<string | undefined>
  const pathsToClear = ['/', '/admin', '/admin/'] as const
  for (const d of domainsToClear) {
    const domainAttr = d ? `; Domain=${d}` : ''
    for (const path of pathsToClear) {
      document.cookie = `${PAYLOAD_TENANT_COOKIE}=; Path=${path}; Max-Age=0; SameSite=Lax${domainAttr}`
    }
  }

  const domainAttr = domain ? `; Domain=${domain}` : ''
  const maxAgeAttrs = isSet ? `Max-Age=${COOKIE_MAX_AGE_YEAR}` : `Max-Age=0`
  document.cookie = `${PAYLOAD_TENANT_COOKIE}=${encoded}; Path=/; ${maxAgeAttrs}; SameSite=Lax${domainAttr}`
}

export function deleteTenantCookie(getCookieDomain?: () => string | undefined): void {
  if (typeof document === 'undefined') return
  // IMPORTANT: cookies can exist in both "host-only" and "domain-scoped" variants.
  // For example: after selecting a tenant on a subdomain we may set Domain=.rootHostname,
  // then later clearing on the root hostname must also delete that domain-scoped cookie.
  const domain = getCookieDomain?.() ?? getPayloadTenantCookieDomainDefault()
  const baseNoDomain = `${PAYLOAD_TENANT_COOKIE}=; Max-Age=0; SameSite=Lax`
  const baseWithDomain = domain ? `${baseNoDomain}; Domain=${domain}` : null

  const paths = ['/', '/admin', '/admin/'] as const
  for (const path of paths) {
    document.cookie = `${baseNoDomain}; Path=${path}`
    if (baseWithDomain) document.cookie = `${baseWithDomain}; Path=${path}`
  }
}

export function getTenantCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${PAYLOAD_TENANT_COOKIE}=([^;]*)`))
  return match?.[1] != null ? decodeURIComponent(match[1]) : undefined
}


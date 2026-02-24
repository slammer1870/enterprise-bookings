/**
 * Cookie domain for payload-tenant when admin is accessed via subdomain or custom domain.
 * - Platform subdomain (e.g. acme.atnd-me.com): Domain=.rootHostname so cookie is shared.
 * - Custom domain (e.g. studio.example.com): return undefined so cookie is host-only and works on that domain.
 */
export function getPayloadTenantCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
  if (!serverUrl) return undefined
  try {
    const rootHostname = new URL(serverUrl).hostname
    const current = window.location.hostname
    if (current === rootHostname) return undefined
    if (rootHostname === 'localhost') {
      // e.g. tenant.localhost -> use .localhost so cookie is shared
      if (current.endsWith('.localhost')) return '.localhost'
      return undefined
    }
    if (current.endsWith('.' + rootHostname)) return `.${rootHostname}`
    // Custom domain: no domain attribute so cookie is scoped to current host only
    return undefined
  } catch {
    return undefined
  }
}

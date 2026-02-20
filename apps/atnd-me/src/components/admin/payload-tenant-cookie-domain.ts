/**
 * Cookie domain for payload-tenant when admin is accessed via subdomain.
 * Setting Domain=.rootHostname makes the cookie shared across subdomains and root,
 * so RSC/server requests always see the same tenant selection and the create form
 * doesn't "reload" on every input (caused by server seeing no cookie and returning
 * different initialValue, which overwrites client form state).
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
    return undefined
  } catch {
    return undefined
  }
}

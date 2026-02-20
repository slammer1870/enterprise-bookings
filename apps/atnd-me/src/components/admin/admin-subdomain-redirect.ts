/**
 * Helpers for redirecting admin to the correct subdomain when the user changes
 * tenant in the sidebar. On subdomain, tenant-slug cookie and URL must match the
 * selected tenant or the dashboard can break (mismatch between payload-tenant and subdomain).
 */

/**
 * Returns the current subdomain (e.g. "tenant1") or null if on root or not in browser.
 */
export function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
  if (!serverUrl) return null
  try {
    const rootHostname = new URL(serverUrl).hostname
    const current = window.location.hostname
    if (current === rootHostname) return null
    if (rootHostname === 'localhost' && current.endsWith('.localhost')) {
      const sub = current.replace(/\.localhost$/, '')
      return sub || null
    }
    if (current.endsWith('.' + rootHostname)) {
      const prefix = current.slice(0, -(rootHostname.length + 1))
      return prefix.split('.')[0] || null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Returns whether the admin is currently on a tenant subdomain (so we should
 * redirect when tenant selection changes to keep URL in sync).
 */
export function isOnAdminSubdomain(): boolean {
  return getCurrentSubdomain() != null
}

/**
 * Builds the full admin URL for the given tenant slug (or root domain if slug is null).
 * Uses current pathname and protocol/port from window.location.
 */
export function getAdminURLForTenantSlug(slug: string | null): string {
  if (typeof window === 'undefined') return ''
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
  if (!serverUrl) return window.location.href
  try {
    const url = new URL(serverUrl)
    const rootHostname = url.hostname
    const protocol = window.location.protocol
    const port = window.location.port

    let hostname: string
    if (slug && slug.trim() !== '') {
      hostname =
        rootHostname === 'localhost'
          ? `${slug.trim()}.localhost`
          : `${slug.trim()}.${rootHostname}`
    } else {
      hostname = rootHostname
    }

    const portSuffix = port ? `:${port}` : ''
    const pathname = window.location.pathname
    const search = window.location.search
    return `${protocol}//${hostname}${portSuffix}${pathname}${search}`
  } catch {
    return window.location.href
  }
}

import {
  getAbsoluteURL,
  getRequestOrigin,
  getTenantSiteURL,
  type TenantURLSource,
} from '@/utilities/getURL'

/** Restrict callback paths to same-site relative URLs. */
export function sanitizeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback
  return trimmed
}

export function buildAuthCallbackURL(args: {
  redirectTo: string
  tenant?: TenantURLSource | null
  headers?: Headers | null
  serverUrlFallback?: string
}): string {
  const path = sanitizeRedirectPath(args.redirectTo)
  const base =
    args.tenant != null && (args.tenant.hostnames != null || args.tenant.slug != null)
      ? getTenantSiteURL(args.tenant, args.headers)
      : getRequestOrigin(args.headers) || args.serverUrlFallback

  if (!base) {
    throw new Error('Missing request origin for magic link callbackURL')
  }

  return getAbsoluteURL(path, base)
}

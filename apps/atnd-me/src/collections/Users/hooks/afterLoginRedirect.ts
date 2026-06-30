/**
 * Post-login redirect hook.
 *
 * After a successful login, checks whether the user landed on the correct host
 * and sets a short-lived `__atnd_post_login_redirect` cookie to signal the
 * appropriate redirect target to the Next.js middleware.
 *
 * This replaces the previous approach of calling /api/admin/authorize-tenant on
 * every admin request and signalling redirects back to middleware via custom
 * response headers. The DB lookup now happens once (at login time) instead of
 * on every admin navigation.
 *
 * Redirect targets stored in the cookie:
 *   'base'         → redirect to base-domain /admin/login
 *   'tenant:<slug>' → redirect to <slug>.<rootHostname>/admin
 */
import type { CollectionAfterLoginHook } from 'payload'
import { mergeHeaders } from 'payload'

import { getUserTenantIDs, loadUserDocForTenantMembership } from '../../../access/tenant-scoped'
import { isAdmin } from '../../../access/userTenantAccess'
import { getPlatformHostname } from '@/utilities/getURL'
import { POST_LOGIN_REDIRECT_COOKIE } from './constants'

export { POST_LOGIN_REDIRECT_COOKIE } from './constants'

const COOKIE_TTL_SECONDS = 60

function getLoginHostname(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? ''
  const host = req.headers.get('host')?.trim() ?? ''
  const raw = fwd || host
  return (raw.split(':')[0] ?? '').toLowerCase()
}

function extractSubdomain(hostname: string, rootHostname: string | null): string | null {
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1 && parts[0] && parts[0] !== 'localhost') return parts[0]
    return null
  }
  if (rootHostname && hostname.endsWith(`.${rootHostname}`)) {
    const prefix = hostname.slice(0, -(rootHostname.length + 1))
    return prefix.split('.')[0] || null
  }
  return null
}

function setRedirectCookie(req: Parameters<CollectionAfterLoginHook>[0]['req'], value: string): void {
  const expires = new Date(Date.now() + COOKIE_TTL_SECONDS * 1000)
  // Use SameSite=Lax (not Strict) so the cookie is included on top-level navigations.
  // Note: this only applies when the login goes through the Better Auth route handler
  // (api/auth/[...all]/route.ts), which correctly propagates response headers. Payload's
  // own /api/users/login endpoint does not forward req.responseHeaders to the HTTP response.
  const cookieStr = `${POST_LOGIN_REDIRECT_COOKIE}=${value}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax`
  const newHeaders = new Headers({ 'Set-Cookie': cookieStr })
  req.responseHeaders = req.responseHeaders
    ? mergeHeaders(req.responseHeaders, newHeaders)
    : newHeaders
}

export const afterLoginRedirect: CollectionAfterLoginHook = async ({ req, user }) => {
  const rootHostname = getPlatformHostname()?.toLowerCase() ?? null
  const hostname = getLoginHostname(req)
  const subdomain = extractSubdomain(hostname, rootHostname)
  const isSuperAdmin = isAdmin(user)

  const userId =
    typeof user.id === 'number'
      ? user.id
      : typeof user.id === 'string' && /^\d+$/.test(user.id)
        ? parseInt(user.id, 10)
        : NaN

  const fullUser = Number.isFinite(userId)
    ? await loadUserDocForTenantMembership(req.payload, userId).catch(() => null)
    : null

  const tenantAdminIds = fullUser
    ? getUserTenantIDs(fullUser, ['admin', 'staff', 'location-manager'])
    : []

  if (subdomain) {
    // Logged into a tenant subdomain.
    if (isSuperAdmin && tenantAdminIds.length === 0) {
      // Super-admin with no tenant memberships: their home is the base domain admin.
      setRedirectCookie(req, 'base')
      return user
    }

    if (!isSuperAdmin && tenantAdminIds.length > 0) {
      // Check whether this user actually has access to the subdomain tenant.
      const tenantResult = await req.payload
        .find({
          collection: 'tenants',
          where: { slug: { equals: subdomain } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)

      const tenantDoc = tenantResult?.docs[0]
      const tenantId = tenantDoc
        ? typeof tenantDoc.id === 'number'
          ? tenantDoc.id
          : typeof tenantDoc.id === 'string' && /^\d+$/.test(tenantDoc.id)
            ? parseInt(tenantDoc.id, 10)
            : null
        : null

      if (tenantId != null && !tenantAdminIds.includes(tenantId)) {
        // User doesn't have access to this tenant. Redirect to their primary tenant.
        const primaryTenantId = tenantAdminIds[0]!
        const primaryTenant = await req.payload
          .findByID({
            collection: 'tenants',
            id: primaryTenantId,
            depth: 0,
            overrideAccess: true,
          })
          .catch(() => null)

        const primarySlug =
          primaryTenant && typeof primaryTenant === 'object' && 'slug' in primaryTenant
            ? String((primaryTenant as { slug?: string }).slug ?? '').trim()
            : ''

        setRedirectCookie(req, primarySlug ? `tenant:${primarySlug}` : 'base')
        return user
      }
    }
  } else {
    // Logged into the base domain.
    if (!isSuperAdmin && tenantAdminIds.length === 1) {
      // Single-tenant admin: redirect them to their tenant subdomain.
      const tenantId = tenantAdminIds[0]!
      const tenant = await req.payload
        .findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)

      const slug =
        tenant && typeof tenant === 'object' && 'slug' in tenant
          ? String((tenant as { slug?: string }).slug ?? '').trim()
          : ''

      if (slug) {
        setRedirectCookie(req, `tenant:${slug}`)
        return user
      }
    }
  }

  return user
}

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { findTenantByDomainNormalized, findTenantBySlugNormalized } from '@/lib/tenantDbResolve'
import {
  getUserTenantIds,
  getUserTenantIDs,
  loadUserDocForTenantMembership,
} from '@/access/tenant-scoped'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'
import { getPlatformHostname } from '@/utilities/getURL'
import {
  collectTenantLookupHostnames,
  getPayloadTenantIdFromRequest,
  getTenantSlugFromRequest,
} from '@/utilities/tenantRequest'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

function parsePayloadTenantId(request: NextRequest): number | null {
  return getPayloadTenantIdFromRequest({ cookies: request.cookies })
}

function coerceTenantId(id: unknown): number | null {
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

/**
 * Resolve tenant id from Host / X-Forwarded-Host when the site is on a custom domain
 * (same rules as middleware + `resolveTenantIdFromRequest` in tenant-scoped).
 * Without this, `tenant-slug` may be skipped (proxy Host = platform) and slug-from-host is null for custom domains → wrong403/redirect loops.
 */
async function resolveTenantIdFromRequestHosts(args: {
  payload: Awaited<ReturnType<typeof getPayload>>
  request: NextRequest
}): Promise<number | null> {
  const { payload, request } = args
  const platformHostname = getPlatformHostname()?.toLowerCase() ?? null

  for (const hostRaw of collectTenantLookupHostnames(request.headers)) {
    const hostname = (hostRaw.split(':')[0] ?? '').trim().toLowerCase()
    if (!hostname) continue
    if (hostname.includes('localhost')) continue
    if (platformHostname && (hostname === platformHostname || hostname.endsWith(`.${platformHostname}`))) {
      continue
    }

    const normalized = normalizeCustomDomain(hostname)
    if (!normalized) continue

    const tenant = await findTenantByDomainNormalized(payload, normalized).catch(() => null)
    const tid = tenant ? coerceTenantId(tenant.id) : null
    if (tid != null) return tid
  }

  return null
}

async function resolveRequestedTenantId(args: {
  payload: Awaited<ReturnType<typeof getPayload>>
  request: NextRequest
}): Promise<number | null> {
  const { payload, request } = args

  const tidFromCookie = parsePayloadTenantId(request)
  const tenantSlug = getTenantSlugFromRequest({ cookies: request.cookies, headers: request.headers })?.toLowerCase()

  // Fast path: `payload-tenant` + `tenant-slug` agree (PK lookup only; skips slug-normalized query).
  if (
    tidFromCookie != null &&
    tenantSlug &&
    /^[a-z0-9-]+$/.test(tenantSlug)
  ) {
    const tenant = await payload
      .findByID({
        collection: 'tenants',
        id: tidFromCookie,
        depth: 0,
        overrideAccess: true,
        select: { slug: true },
      })
      .catch(() => null)
    const docSlug =
      tenant && typeof tenant === 'object' && tenant !== null && 'slug' in tenant
        ? String((tenant as { slug?: string }).slug ?? '')
            .trim()
            .toLowerCase()
        : null
    if (docSlug === tenantSlug) return tidFromCookie
  }

  // Fallback: first-load of `/admin/login` on a tenant host may not yet have `payload-tenant`.
  // Use the host-scoped `tenant-slug` cookie (set by middleware) to resolve the tenant id.
  if (tenantSlug && /^[a-z0-9-]+$/.test(tenantSlug)) {
    const tenant = await findTenantBySlugNormalized(payload, tenantSlug).catch(() => null)
    const tid = tenant ? coerceTenantId(tenant.id) : null
    if (tid != null) return tid
  }

  const fromHost = await resolveTenantIdFromRequestHosts({ payload, request })
  if (fromHost != null) return fromHost

  return tidFromCookie
}

async function resolveTenantIdsForUser(args: {
  payload: Awaited<ReturnType<typeof getPayload>>
  user: SharedUser
}): Promise<{ tenantIds: number[] | null; fullUser: unknown }> {
  const { payload, user } = args
  const direct = getUserTenantIds(user)
  if (direct === null) return { tenantIds: null, fullUser: user } // super-admin: all tenants

  // Always load the full user doc to get tenants[n].roles populated.
  const idRaw = typeof user === 'object' && user !== null && 'id' in user ? (user as { id: unknown }).id : null
  const id =
    typeof idRaw === 'number' ? idRaw : typeof idRaw === 'string' && /^\d+$/.test(idRaw) ? parseInt(idRaw, 10) : NaN

  const fullUser = Number.isFinite(id) ? await loadUserDocForTenantMembership(payload, id) : null

  // Primary: use tenants[n].roles (consolidated per-tenant model).
  const fromTenantRoles = fullUser ? getUserTenantIDs(fullUser, ['admin', 'staff', 'location-manager']) : []
  if (fromTenantRoles.length > 0) {
    return { tenantIds: fromTenantRoles, fullUser }
  }

  // Fallback: global role + tenants membership (pre-migration window).
  if (direct.length > 0) return { tenantIds: direct, fullUser }
  const fromDb = fullUser ? getUserTenantIds(fullUser as unknown as SharedUser) : direct
  return { tenantIds: fromDb === null ? null : fromDb, fullUser }
}

/**
 * Server-side guard for multi-tenant admin access.
 *
 * - 204: OK (either unauthenticated, admin, or tenant-admin authorized for current tenant)
 * - 401: unauthenticated
 * - 403: authenticated but forbidden for requested tenant
 *
 * Notes:
 * - This endpoint is used by Next middleware on `/admin` routes to prevent tenant-admins
 *   from loading the admin UI on a tenant they don't have access to.
 */
export async function GET(request: NextRequest) {
  let payload: Awaited<ReturnType<typeof getPayload>>
  try {
    payload = await getPayload()
  } catch {
    // Payload initialisation failed (e.g. DB unavailable). Return 500 so middleware
    // knows this is an error and does not redirect /admin/login → /admin.
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
  }

  let authResult: Awaited<ReturnType<typeof payload.auth>>
  try {
    authResult = await payload.auth({ headers: request.headers })
  } catch {
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 })
  }
  const { user } = authResult

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sharedUser = user as unknown as SharedUser
  if (checkRole(['super-admin'], sharedUser)) {
    // Super-admins have unrestricted access to all admin areas.
    // UX redirect: when a super-admin who has no tenant memberships is on a
    // tenant-subdomain context (browser carries a tenant-slug cookie), signal middleware
    // to redirect them to the base-domain admin/login on the post-login navigation —
    // their natural home. This is a navigation aid only; super-admins can always navigate
    // back to any tenant admin directly without restriction.
    const tenantSlugCookieValue = request.cookies.get('tenant-slug')?.value?.trim() ?? null
    if (tenantSlugCookieValue) {
      const idRaw =
        typeof sharedUser === 'object' && sharedUser !== null && 'id' in sharedUser
          ? (sharedUser as { id: unknown }).id
          : null
      const userId =
        typeof idRaw === 'number'
          ? idRaw
          : typeof idRaw === 'string' && /^\d+$/.test(idRaw)
            ? parseInt(idRaw, 10)
            : NaN
      const fullUser = Number.isFinite(userId)
        ? await loadUserDocForTenantMembership(payload, userId).catch(() => null)
        : null
      const tenants =
        fullUser && typeof fullUser === 'object' && 'tenants' in fullUser
          ? (fullUser as { tenants?: unknown[] }).tenants
          : null
      const hasTenantMemberships = Array.isArray(tenants) && tenants.length > 0
      if (!hasTenantMemberships) {
        const redirectSignalRes = new NextResponse(null, { status: 204 })
        redirectSignalRes.headers.set('X-Base-Domain-Redirect', '1')
        return redirectSignalRes
      }
    }
    return new NextResponse(null, { status: 204 })
  }

  // A user is a tenant portal user if they have a global elevated role OR
  // any elevated role in the per-tenant tenants[n].roles array.
  const { tenantIds: allowedTenantIds, fullUser } = await resolveTenantIdsForUser({ payload, user: sharedUser })

  const hasGlobalElevatedRole = checkRole(['admin', 'staff', 'location-manager'], sharedUser)
  const hasTenantRoleElevation = fullUser ? getUserTenantIDs(fullUser, ['admin', 'staff', 'location-manager']).length > 0 : false

  if (!hasGlobalElevatedRole && !hasTenantRoleElevation) {
    // Non-admin users should not be in the Payload admin UI at all.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requestedTenantId = await resolveRequestedTenantId({ payload, request })
  if (!requestedTenantId) {
    // Root/platform-host navigation with no tenant cookie.
    //
    // For non-super-admin tenant admins, send a redirect hint so middleware can bounce them to
    // their primary tenant's subdomain (e.g. atnd.me/admin → tenant-a.atnd.me/admin).
    // This matches the Payload multi-tenant example pattern: admins always operate from their
    // own tenant subdomain, never from the shared root host.
    //
    // We pick allowedTenantIds[0] as the "primary" tenant (the first entry in their tenants
    // array). For single-tenant admins this is always correct; for multi-tenant admins it lands
    // them on a reasonable default and they can switch via the Payload tenant selector.
    if (allowedTenantIds !== null && allowedTenantIds.length === 1) {
      const primaryTenantId = allowedTenantIds[0]!
      const tenant = await payload
        .findByID({
          collection: 'tenants',
          id: primaryTenantId,
          depth: 0,
          overrideAccess: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          select: { slug: true } as any,
        })
        .catch(() => null)
      const slug =
        tenant && typeof tenant === 'object' && 'slug' in tenant
          ? String((tenant as { slug?: unknown }).slug ?? '').trim()
          : ''
      if (slug) {
        const res = new NextResponse(null, { status: 204 })
        res.headers.set('X-Tenant-Redirect', slug)
        return res
      }
    }

    // Fallback: allow root-host admin access (e.g. super-admin-only or test envs).
    return new NextResponse(null, { status: 204 })
  }

  if (allowedTenantIds === null) {
    // Shouldn't happen for non-super-admin, but keep semantics: null = all tenants
    return new NextResponse(null, { status: 204 })
  }

  if (!allowedTenantIds.includes(requestedTenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return new NextResponse(null, { status: 204 })
}

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { findTenantByDomainNormalized, findTenantBySlugNormalized } from '@/lib/tenantDbResolve'
import { getUserTenantIds, loadUserDocForTenantMembership } from '@/access/tenant-scoped'
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
}): Promise<number[] | null> {
  const { payload, user } = args
  const direct = getUserTenantIds(user)
  if (direct === null) return null // admin: all tenants
  if (direct.length > 0) return direct

  // Session/JWT user may omit relationships like `tenants`. Fetch full user doc and retry.
  const idRaw = typeof user === 'object' && user !== null && 'id' in user ? (user as { id: unknown }).id : null
  const id =
    typeof idRaw === 'number' ? idRaw : typeof idRaw === 'string' && /^\d+$/.test(idRaw) ? parseInt(idRaw, 10) : NaN
  if (!Number.isFinite(id)) return direct

  const fullUser = await loadUserDocForTenantMembership(payload, id)

  const fromDb = fullUser ? getUserTenantIds(fullUser as unknown as SharedUser) : direct
  return fromDb === null ? null : fromDb
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
  const payload = await getPayload()
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sharedUser = user as unknown as SharedUser
  if (checkRole(['super-admin'], sharedUser)) {
    return new NextResponse(null, { status: 204 })
  }

  const isTenantPortalUser = checkRole(['admin', 'staff'], sharedUser)
  if (!isTenantPortalUser) {
    // Non-admin users should not be in the Payload admin UI at all.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requestedTenantId = await resolveRequestedTenantId({ payload, request })
  if (!requestedTenantId) {
    // Root-host admin navigation (e.g. localhost/admin in tests) may not carry payload-tenant.
    // In that case, allow the session and rely on collection access controls / tenant selectors.
    // Cross-tenant host access is still blocked because middleware sets payload-tenant from host.
    return new NextResponse(null, { status: 204 })
  }

  const allowedTenantIds = await resolveTenantIdsForUser({ payload, user: sharedUser })
  if (allowedTenantIds === null) {
    // Shouldn't happen for tenant-admin, but keep semantics: null = all tenants
    return new NextResponse(null, { status: 204 })
  }

  if (!allowedTenantIds.includes(requestedTenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return new NextResponse(null, { status: 204 })
}

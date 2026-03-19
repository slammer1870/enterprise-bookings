import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getUserTenantIds } from '@/access/tenant-scoped'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

function parsePayloadTenantId(request: NextRequest): number | null {
  const raw = request.cookies.get('payload-tenant')?.value
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = parseInt(raw, 10)
  return Number.isFinite(id) ? id : null
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

  const fullUser = await payload
    .findByID({
      collection: 'users',
      id,
      depth: 2,
      overrideAccess: true,
    })
    .catch(() => null)

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
  const isAdmin = checkRole(['admin'], sharedUser)
  if (isAdmin) {
    return new NextResponse(null, { status: 204 })
  }

  const isTenantAdmin = checkRole(['tenant-admin'], sharedUser)
  if (!isTenantAdmin) {
    // Non-admin users should not be in the Payload admin UI at all.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requestedTenantId = parsePayloadTenantId(request)
  if (!requestedTenantId) {
    // No tenant selected / resolved. For tenant-admins, treat this as forbidden because
    // it corresponds to "all tenants" / root context.
    return NextResponse.json({ error: 'Tenant required' }, { status: 403 })
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


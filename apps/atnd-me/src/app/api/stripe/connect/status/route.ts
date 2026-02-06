/**
 * Step 2.6 – Stripe Connect status for admin UX.
 * GET returns { connected, tenantSlug } for the current user's tenant (tenant-admin only).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'

export async function GET(request: NextRequest) {
  const payload = await getPayload()
  const authResult = await payload.auth({ headers: request.headers })
  let user = (authResult?.user as SharedUser) ?? null

  if (!user || (!isAdmin(user) && !isTenantAdmin(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Auth/session user often does not have tenants relationship populated; always fetch full user for tenant-admin
  const userId = user.id != null ? Number(user.id) : NaN
  if (isTenantAdmin(user) && Number.isFinite(userId)) {
    const fullUser = await payload
      .findByID({
        collection: 'users',
        id: userId,
        depth: 2,
        overrideAccess: true,
      })
      .catch(() => null)
    if (fullUser) {
      user = fullUser as unknown as SharedUser
    }
    // Fallback: find() sometimes populates relations when findByID does not
    if (!fullUser) {
      const found = await payload.find({
        collection: 'users',
        where: { id: { equals: userId } },
        limit: 1,
        depth: 2,
        overrideAccess: true,
      })
      const doc = found.docs?.[0]
      if (doc) {
        user = doc as unknown as SharedUser
      }
    }
  }

  let tenantIds = getUserTenantIds(user)
  // Fallback: tenants relation may be empty from join table; use registrationTenant for tenant-admin
  if (isTenantAdmin(user) && (tenantIds === null || tenantIds.length === 0)) {
    const reg = (user as unknown as { registrationTenant?: number | { id: number } }).registrationTenant
    const tid =
      typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
    if (typeof tid === 'number') {
      tenantIds = [tid]
    }
  }
  if (tenantIds === null || tenantIds.length === 0) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  }

  const tenantId = tenantIds[0] as number
  const result = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  if (!result) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const slug = typeof result.slug === 'string' ? result.slug : undefined
  const status = result.stripeConnectOnboardingStatus as string | undefined
  const connected = status === 'active'

  return NextResponse.json({ connected, tenantSlug: slug })
}

/**
 * Active `locations` rows for the current admin tenant (`payload-tenant`), for the branch/site selector.
 * Respects membership and pure `location-manager` assignments.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { isAdmin } from '@/access/userTenantAccess'
import { getUserTenantIds, loadUserDocForTenantMembership } from '@/access/tenant-scoped'
import {
  isPureLocationManager,
  resolvePureLocationManagerBranchIds,
} from '@/access/locationManagerScope'
import { getPayloadTenantIdFromRequest } from '@/utilities/tenantRequest'

type LocationRow = { id: number; name: string; slug: string }

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!checkRole(['super-admin', 'admin', 'staff', 'location-manager'], user as Parameters<typeof checkRole>[1])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tenantId = getPayloadTenantIdFromRequest({ cookies: request.cookies })
    if (!tenantId) {
      return NextResponse.json({ tenantId: null, locations: [] satisfies LocationRow[] })
    }

    if (!isAdmin(user)) {
      let allowed = getUserTenantIds(user as SharedUser)
      if (allowed !== null && !allowed.includes(tenantId)) {
        // JWT may omit `tenants`; load from DB before rejecting (mirrors authorize-tenant pattern).
        const idRaw = typeof user === 'object' && user !== null && 'id' in user ? (user as { id: unknown }).id : null
        const uid =
          typeof idRaw === 'number' ? idRaw
          : typeof idRaw === 'string' && /^\d+$/.test(idRaw) ? parseInt(idRaw, 10)
          : NaN
        if (Number.isFinite(uid)) {
          const full = await loadUserDocForTenantMembership(payload, uid)
          if (full) {
            const fromDb = getUserTenantIds(full as unknown as SharedUser)
            allowed = fromDb === null ? null : fromDb
          }
        }
      }
      if (allowed !== null && !allowed.includes(tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const found = await payload.find({
      collection: 'locations',
      where: {
        tenant: { equals: tenantId },
        active: { equals: true },
      },
      limit: 200,
      depth: 0,
      sort: 'name',
      overrideAccess: true,
    })

    let docs = (found.docs ?? []) as Array<{ id?: number; name?: string; slug?: string }>

    if (isPureLocationManager(user)) {
      const branchIds = await resolvePureLocationManagerBranchIds({
        payload,
        user,
        tenantIds: [tenantId],
      })
      const allowed = new Set(branchIds)
      docs = docs.filter((d) => typeof d.id === 'number' && allowed.has(d.id))
    }

    const locations: LocationRow[] = docs
      .filter((d) => typeof d.id === 'number' && typeof d.name === 'string' && typeof d.slug === 'string')
      .map((d) => ({ id: d.id as number, name: d.name as string, slug: d.slug as string }))

    return NextResponse.json({ tenantId, locations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load branch options'
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/admin/branch-selector-options]', err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to load branch options' }, { status: 500 })
  }
}

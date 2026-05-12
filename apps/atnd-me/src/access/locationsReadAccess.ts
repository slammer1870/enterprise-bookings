import type { Access, PayloadRequest, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import {
  resolveTenantAdminReadConstraint,
  resolveTenantAdminTenantIds,
  resolveTenantIdFromRequest,
  type RequestLike,
} from '@/access/tenant-scoped'
import {
  branchIdsForUserInTenants,
  isPureLocationManager,
  loadUserForLocationAssignments,
  relationIdFromPayloadField,
  resolvePureLocationManagerBranchIds,
} from '@/access/locationManagerScope'
import {
  getPayloadLocationIdFromRequest,
  getPayloadTenantIdFromRequest,
} from '@/utilities/tenantRequest'

function tenantAdminCookieSource(req: PayloadRequest): {
  cookies?: { get: (name: string) => { value?: string } | undefined }
} {
  return {
    cookies: (req as PayloadRequest & { cookies?: { get: (name: string) => { value?: string } | undefined } })
      .cookies,
  }
}

function toUserId(user: unknown): number | null {
  if (user == null || typeof user !== 'object' || !('id' in user)) return null
  const id = (user as { id: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

/**
 * Locations read: same tenant rules as {@link tenantScopedPublicReadStrict}, but pure
 * `location-manager` users only see assigned branch rows (by `id`), with optional
 * `payload-tenant` / `payload-location` cookie semantics aligned to timeslots.
 */
export const locationsReadAccess: Access = async (args) => {
  const { req } = args
  const user = req.user

  if (user && checkRole(['super-admin'], user as SharedUser)) {
    return true
  }

  if (user && checkRole(['admin', 'staff'], user as SharedUser)) {
    return resolveTenantAdminReadConstraint({ req: req as any })
  }

  if (user && isPureLocationManager(user)) {
    const tenantIds = await resolveTenantAdminTenantIds({
      user,
      payload: req.payload,
      context: req.context as Record<string, unknown> | undefined,
    })
    if (!tenantIds.length) return false

    const branchIdsAll = await resolvePureLocationManagerBranchIds({
      payload: req.payload,
      user,
      tenantIds,
    })
    if (!branchIdsAll.length) return false

    const cookieSrc = tenantAdminCookieSource(req as PayloadRequest)
    const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
    const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)

    if (selectedTenantId != null) {
      if (!tenantIds.includes(selectedTenantId)) return false

      const uid = toUserId(user)
      if (uid == null) return false
      const full = await loadUserForLocationAssignments(req.payload, uid)
      const branchesInTenant = branchIdsForUserInTenants(full, [selectedTenantId])
      if (!branchesInTenant.length) return false

      if (selectedBranchId != null) {
        if (!branchesInTenant.includes(selectedBranchId)) return false
        const location = await req.payload.findByID({
          collection: 'locations',
          id: selectedBranchId,
          depth: 0,
          overrideAccess: true,
        })
        if (!location) return false
        const locTenantId = relationIdFromPayloadField(location.tenant)
        if (locTenantId !== selectedTenantId) return false
        return { id: { equals: selectedBranchId } } as Where
      }

      return { id: { in: branchesInTenant } } as Where
    }

    return { id: { in: branchIdsAll } } as Where
  }

  const tenantId = await resolveTenantIdFromRequest(req as RequestLike)
  if (!tenantId) return false

  return {
    tenant: {
      equals: tenantId,
    },
  }
}

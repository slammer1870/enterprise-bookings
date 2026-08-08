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
  isPureLocationManager,
  relationIdFromPayloadField,
  resolveBranchAssignmentScope,
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

async function whereForBranchScopedUser(args: {
  req: PayloadRequest
  user: unknown
}): Promise<boolean | Where> {
  const { req, user } = args
  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  if (!tenantIds.length) return false

  const scopeAll = await resolveBranchAssignmentScope({
    payload: req.payload,
    user,
    tenantIds,
  })

  const cookieSrc = tenantAdminCookieSource(req)
  const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
  const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)

  if (scopeAll.kind === 'unrestricted') {
    if (selectedTenantId != null) {
      if (!tenantIds.includes(selectedTenantId)) return false
      if (selectedBranchId != null) {
        return { id: { equals: selectedBranchId } } as Where
      }
      return { tenant: { equals: selectedTenantId } } as Where
    }
    return resolveTenantAdminReadConstraint({ req: req as any })
  }

  if (!scopeAll.ids.length) return false

  if (selectedTenantId != null) {
    if (!tenantIds.includes(selectedTenantId)) return false

    const tenantScope = await resolveBranchAssignmentScope({
      payload: req.payload,
      user,
      tenantIds: [selectedTenantId],
    })
    if (tenantScope.kind === 'unrestricted') {
      if (selectedBranchId != null) return { id: { equals: selectedBranchId } } as Where
      return { tenant: { equals: selectedTenantId } } as Where
    }
    const branchesInTenant = tenantScope.ids
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

  return { id: { in: scopeAll.ids } } as Where
}

/**
 * Locations read: tenant rules + branch assignment from `tenants[].locations`.
 * Org admins always see all tenant locations. Staff / location-managers with a
 * non-empty assignment see only those branches; empty assignment = all locations.
 */
export const locationsReadAccess: Access = async (args) => {
  const { req } = args
  const user = req.user

  if (user && checkRole(['super-admin'], user as SharedUser)) {
    return true
  }

  // Org admin: all locations in their tenants
  if (user && checkRole(['admin'], user as SharedUser)) {
    return resolveTenantAdminReadConstraint({ req: req as any })
  }

  // Staff or pure location-manager: honor tenants[].locations (empty = all)
  if (user && (checkRole(['staff'], user as SharedUser) || isPureLocationManager(user))) {
    return whereForBranchScopedUser({ req: req as PayloadRequest, user })
  }

  const tenantId = await resolveTenantIdFromRequest(req as RequestLike)
  if (!tenantId) return false

  return {
    tenant: {
      equals: tenantId,
    },
  }
}

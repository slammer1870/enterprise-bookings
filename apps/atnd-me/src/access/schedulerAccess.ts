import type { Access, AccessArgs, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import { isPureLocationManager, resolveBranchAssignmentScope } from '@/access/locationManagerScope'
import {
  loadUserDocForTenantMembership,
  resolveTenantAdminTenantIds,
  tenantScopedCreate,
  tenantScopedReadFiltered,
} from '@/access/tenant-scoped'
import {
  isAdmin,
  isLocationManager,
  isStaffOnlyUser,
  isTenantAdmin,
} from '@/access/userTenantAccess'
import { getPayloadLocationIdFromRequest } from '@/utilities/tenantRequest'

function toUserId(user: unknown): number | null {
  if (user == null || typeof user !== 'object' || !('id' in user)) return null
  const id = (user as { id: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

/**
 * Sidebar / collection admin: org admins and location-managers (not staff-only).
 * Hydrates memberships when the session omits `tenants[]`.
 */
export const schedulerAdminAccess = async ({ req }: AccessArgs): Promise<boolean> => {
  const { user, payload } = req
  if (!user) return false
  if (isAdmin(user)) return true

  let accessUser: unknown = user
  const tenants = (user as { tenants?: unknown }).tenants
  if (!Array.isArray(tenants) || tenants.length === 0) {
    const uid = toUserId(user)
    if (uid != null) {
      const full = await loadUserDocForTenantMembership(payload, uid)
      if (full) accessUser = full
    }
  }

  if (isTenantAdmin(accessUser) || isLocationManager(accessUser)) return true
  // Derived global role cache when memberships still unavailable.
  return checkRole(['location-manager'], accessUser as SharedUser)
}

async function locationManagerSchedulerWhere(args: {
  user: unknown
  payload: AccessArgs['req']['payload']
  context?: Record<string, unknown>
}): Promise<Where | false> {
  const { user, payload, context } = args
  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload,
    context,
  })
  if (tenantIds.length === 0) return false

  const scope = await resolveBranchAssignmentScope({ payload, user, tenantIds })
  if (scope.kind === 'unrestricted') {
    return { tenant: { in: tenantIds } }
  }
  if (scope.ids.length === 0) return false
  return {
    and: [{ tenant: { in: tenantIds } }, { branch: { in: scope.ids } }],
  }
}

/**
 * Read: tenant-scoped for admins; pure location-managers limited to assigned branches.
 * Also honors `payload-location` when set (same as prior scheduler list behaviour).
 */
export const schedulerReadAccess: Access = async (args) => {
  const { req } = args
  const user = req.user

  let base: boolean | Where
  if (user && isPureLocationManager(user)) {
    const lmWhere = await locationManagerSchedulerWhere({
      user,
      payload: req.payload,
      context: req.context as Record<string, unknown> | undefined,
    })
    if (lmWhere === false) return false
    base = lmWhere
  } else {
    base = await tenantScopedReadFiltered(args)
    if (base === false) return false
  }

  const typedReq = req as typeof req & {
    cookies?: { get: (name: string) => { value?: string } | undefined }
  }
  const cookieSrc = typedReq.cookies?.get ? { cookies: typedReq.cookies } : {}
  const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
  if (selectedBranchId == null) return base

  const branchFilter: Where = { branch: { equals: selectedBranchId } }
  if (base === true) return branchFilter
  return { and: [base as Where, branchFilter] }
}

/** Create: staff blocked; location-managers use tenantScopedCreate (branch-checked). */
export const schedulerCreateAccess: Access = async (args) => {
  if (isStaffOnlyUser(args.req.user)) return false
  return tenantScopedCreate(args)
}

/** Update/delete: staff blocked; location-managers constrained to assigned branches. */
export const schedulerUpdateAccess: Access = async (args) => {
  if (isStaffOnlyUser(args.req.user)) return false
  const { user, payload, context } = args.req
  if (!user) return false
  if (checkRole(['super-admin'], user as unknown as SharedUser)) return true

  if (isPureLocationManager(user)) {
    return locationManagerSchedulerWhere({
      user,
      payload,
      context: context as Record<string, unknown> | undefined,
    })
  }

  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload,
    context: context as Record<string, unknown> | undefined,
  })
  if (tenantIds.length === 0) return false

  if (checkRole(['admin', 'staff'], user as unknown as SharedUser) || isTenantAdmin(user)) {
    return { tenant: { in: tenantIds } }
  }

  return false
}

export const schedulerDeleteAccess: Access = schedulerUpdateAccess

import type { Access, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import { isStaffOnlyUser } from '@/access/userTenantAccess'
import {
  resolveTenantAdminTenantIds,
  tenantScopedCreate,
} from '@/access/tenant-scoped'
import { isPureLocationManager, resolvePureLocationManagerBranchIds } from '@/access/locationManagerScope'

/**
 * Timeslot creates: staff blocked; tenant + optional branch rules come from {@link tenantScopedCreate}
 * (including pure `location-manager` branch checks).
 */
export const timeslotsCreateAccess: Access = async (args) => {
  if (isStaffOnlyUser(args.req.user)) return false
  return tenantScopedCreate(args)
}

/**
 * Timeslot updates: staff blocked; pure site managers constrained to assigned branches.
 */
export const timeslotsUpdateAccess: Access = async (args) => {
  if (isStaffOnlyUser(args.req.user)) return false
  const { user, payload, context } = args.req
  if (!user) return false
  if (checkRole(['super-admin'], user as unknown as SharedUser)) return true

  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload,
    context: context as Record<string, unknown> | undefined,
  })
  if (tenantIds.length === 0) return false

  if (isPureLocationManager(user)) {
    const branchIds = await resolvePureLocationManagerBranchIds({ payload, user, tenantIds })
    if (branchIds.length === 0) return false
    return {
      and: [{ tenant: { in: tenantIds } }, { branch: { in: branchIds } }],
    } as Where
  }

  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    return { tenant: { in: tenantIds } }
  }

  return false
}

/** Same tenant + branch scope as {@link timeslotsUpdateAccess}. */
export const timeslotsDeleteAccess: Access = timeslotsUpdateAccess

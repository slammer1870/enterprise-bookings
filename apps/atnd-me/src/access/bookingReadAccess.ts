import type { Access, PayloadRequest, Where } from 'payload'
import { staffOnlyTenantIdsFromUser } from '@repo/bookings-plugin'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { isLocationManager } from './userTenantAccess'
import { loadUserDocForTenantMembership, resolveTenantAdminTenantIds } from './tenant-scoped'

/**
 * Bookings are private operational records.
 * - Super-admins can read all bookings.
 * - Tenant admins and location managers can read bookings in their assigned tenants.
 * - On a tenant where the user is staff and not an org admin, `pending` bookings are hidden.
 * - Regular authenticated users can read only their own bookings.
 * - Anonymous requests cannot read bookings.
 */
function operatorBookingsWhere(tenantIds: number[], staffOnlyIds: number[]): Where {
  const allowed = new Set(tenantIds)
  const staffOnly = [...new Set(staffOnlyIds.filter((id) => allowed.has(id)))]
  const openIds = tenantIds.filter((id) => !staffOnly.includes(id))
  if (staffOnly.length === 0) return { tenant: { in: tenantIds } } as Where

  const withoutPending = {
    and: [{ tenant: { in: staffOnly } }, { status: { not_equals: 'pending' } }],
  } as Where
  if (openIds.length === 0) return withoutPending
  return {
    or: [withoutPending, { tenant: { in: openIds } }],
  } as Where
}

async function userForMembershipRoles(
  req: PayloadRequest,
  user: SharedUser,
): Promise<SharedUser> {
  if (Array.isArray(user.tenants) && user.tenants.length > 0) return user
  const id = typeof user.id === 'number' ? user.id : Number(user.id)
  if (!Number.isFinite(id)) return user
  const full = await loadUserDocForTenantMembership(req.payload, id)
  return (full as SharedUser | null) ?? user
}

export const bookingReadAccess: Access = async ({ req }) => {
  const user = req.user as SharedUser | null
  if (!user) return false

  if (checkRole(['super-admin'], user)) return true

  if (checkRole(['admin', 'staff', 'location-manager'], user) || isLocationManager(user)) {
    const tenantIds = await resolveTenantAdminTenantIds({
      user,
      payload: req.payload,
      context: req.context as Record<string, unknown> | undefined,
    })
    if (tenantIds.length === 0) return false

    const membershipUser = await userForMembershipRoles(req, user)
    let staffOnlyIds = staffOnlyTenantIdsFromUser(membershipUser)
    const membershipsUnknown = !Array.isArray(membershipUser.tenants) || membershipUser.tenants.length === 0
    if (
      staffOnlyIds.length === 0 &&
      membershipsUnknown &&
      checkRole(['staff'], membershipUser) &&
      !checkRole(['admin', 'super-admin'], membershipUser)
    ) {
      staffOnlyIds = tenantIds
    }

    return operatorBookingsWhere(tenantIds, staffOnlyIds)
  }

  return { user: { equals: user.id } } as Where
}

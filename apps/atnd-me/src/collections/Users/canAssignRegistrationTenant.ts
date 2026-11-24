import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import { isAdmin, isLocationManager, isStaff, isTenantAdmin } from '../../access/userTenantAccess'

/**
 * Super-admin, org admin, location-manager, or staff may stamp a tenant on user create.
 * Membership roles win. The `checkRole` fallback is only a shallow session that
 * omitted `tenants[]` and kept the derived global role.
 */
export function canAssignRegistrationTenant(user: unknown): boolean {
  if (!user) return false
  if (isAdmin(user) || isTenantAdmin(user) || isLocationManager(user) || isStaff(user)) {
    return true
  }
  return checkRole(['admin', 'location-manager', 'staff'], user as unknown as SharedUser)
}

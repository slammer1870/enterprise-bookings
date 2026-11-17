import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import { isAdmin, isLocationManager, isTenantAdmin } from '../../access/userTenantAccess'

/** Super-admin, org admin, or location-manager may stamp a tenant on user create. */
export function canAssignRegistrationTenant(user: unknown): boolean {
  return (
    Boolean(user) &&
    (isAdmin(user) ||
      isTenantAdmin(user) ||
      isLocationManager(user) ||
      checkRole(['admin', 'super-admin', 'location-manager'], user as unknown as SharedUser))
  )
}

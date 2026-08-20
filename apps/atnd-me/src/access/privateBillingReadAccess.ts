import type { Access, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { isLocationManager } from './userTenantAccess'
import { resolveTenantAdminTenantIds } from './tenant-scoped'

/**
 * Private read access for billing records.
 * Billing documents must never be readable anonymously.
 */
export const privateBillingReadAccess: Access = async ({ req }) => {
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
    return { tenant: { in: tenantIds } } as Where
  }

  return { user: { equals: user.id } } as Where
}

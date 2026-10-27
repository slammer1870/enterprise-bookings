import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { isTenantPortalUser } from '@/access/userTenantAccess'

/**
 * Admin-panel cancellations do not auto-refund. Customer self-service cancels
 * skip this check by setting `applyCustomerRefundPolicyContext`.
 */
export function shouldApplyCancelRefundForActor(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  if (
    isTenantPortalUser(user) ||
    checkRole(
      ['super-admin', 'admin', 'staff', 'location-manager'],
      user as SharedUser,
    )
  ) {
    return false
  }
  return true
}

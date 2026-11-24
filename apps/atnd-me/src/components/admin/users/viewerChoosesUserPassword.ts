import {
  hasDerivedPortalRole,
  isAdmin,
  isLocationManager,
  isStaff,
  isTenantAdmin,
} from '@/utilities/check-admin-role'

/**
 * Super-admins type a password on the user form. Tenant admins, staff, and
 * location-managers do not — the person sets their own from an emailed link.
 *
 * Org roles are `tenants[].roles`. Global `role` is only the platform
 * super-admin flag, plus a derived cache when the admin session dropped
 * membership rows.
 */
export function viewerChoosesUserPassword(user: unknown): boolean {
  if (!user || typeof user !== 'object') return true
  if (isAdmin(user)) return true
  if (isTenantAdmin(user) || isStaff(user) || isLocationManager(user)) return false
  if (hasDerivedPortalRole(user)) return false
  return false
}

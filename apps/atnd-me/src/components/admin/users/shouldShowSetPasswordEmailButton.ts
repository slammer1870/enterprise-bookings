import { isStaffOnlyUser } from '@/utilities/check-admin-role'

import { viewerChoosesUserPassword } from './viewerChoosesUserPassword'

/**
 * Tenant admins and location-managers see this when they may update the open
 * user. Staff may not update the roster, but they can email a set-password
 * link for accounts in their tenant — the endpoint enforces that scope.
 * Payload omits a denied update instead of sending `update: false`.
 * Super-admins type the password themselves.
 */
export function shouldShowSetPasswordEmailButton(args: {
  user: unknown
  docId: string
  updatePermission: unknown
}): boolean {
  if (!args.docId) return false
  if (viewerChoosesUserPassword(args.user)) return false
  if (args.updatePermission) return true
  return isStaffOnlyUser(args.user)
}

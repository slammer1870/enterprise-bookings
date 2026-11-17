import { getEffectiveUserRoles } from '@repo/shared-utils'
import type { User } from '@repo/shared-types'

/**
 * The edit view shows this button only when the viewer may update the open user.
 * Payload's document-access response omits a denied operation. It does not send `update: false`.
 */
export function shouldShowSetPasswordEmailButton(args: {
  user: unknown
  docId: string
  updatePermission: unknown
}): boolean {
  if (!args.docId) return false
  if (
    args.user &&
    typeof args.user === 'object' &&
    getEffectiveUserRoles(args.user as User).includes('super-admin')
  ) {
    return false
  }
  return Boolean(args.updatePermission)
}

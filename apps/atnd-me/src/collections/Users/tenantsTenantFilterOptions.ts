import type { PayloadRequest, Where } from 'payload'

import {
  getTenantMembershipIdsFromUserDoc,
  loadUserDocForTenantMembership,
  resolveOrgAdminTenantIds,
} from '@/access/tenant-scoped'
import { isAdmin } from '@/access/userTenantAccess'

/**
 * `users.tenants[].tenant` relationship filterOptions.
 *
 * Org admins: return `true` so field validation can accept foreign tenant IDs that
 * collection `beforeChange` re-merges from the DB (after beforeValidate strips them
 * for the form). The admin UI picker is scoped by `Tenants.read` →
 * `resolveOrgAdminTenantIds`, not by this filterOptions result.
 *
 * Injected foreign memberships that are not already on the target user are still
 * dropped by strip + mergeTenantEntriesForAdmin.
 */
export async function usersTenantsTenantFilterOptions({
  req,
}: {
  req: PayloadRequest
}): Promise<Where | boolean> {
  const user = req?.user
  // Local API / system writes often omit req.user; allow (anonymous REST still has
  // tenants stripped in sanitizeUserTenantsAndRolesForWrite).
  if (!user) return true
  if (isAdmin(user)) return true

  const orgAdminIds = await resolveOrgAdminTenantIds({
    user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  // Org admin: open relationship validation (picker uses Tenants.read).
  if (orgAdminIds.length > 0) return true

  // Non-admins (location-manager / staff / user): only their memberships, so
  // profile updates don't 400 on existing tenants[] rows.
  let membershipIds = getTenantMembershipIdsFromUserDoc(user)
  if (membershipIds.length === 0) {
    const idRaw =
      typeof user === 'object' && user !== null && 'id' in user
        ? (user as { id: unknown }).id
        : null
    const userId =
      typeof idRaw === 'number'
        ? idRaw
        : typeof idRaw === 'string'
          ? parseInt(idRaw, 10)
          : NaN
    if (Number.isFinite(userId)) {
      const fullUser = await loadUserDocForTenantMembership(req.payload, userId)
      membershipIds = fullUser ? getTenantMembershipIdsFromUserDoc(fullUser) : []
    }
  }
  if (membershipIds.length === 0) return false
  return { id: { in: membershipIds } }
}

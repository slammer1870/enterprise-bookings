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
 * Org admins may only pick tenants they administer (not every membership).
 * Returning `true` for tenant admins previously allowed the relationship picker /
 * validation path to accept foreign tenant IDs when collection read was open or
 * the session omitted a derived global `admin` role.
 *
 * Cross-tenant user edits still work: afterRead + beforeValidate strip foreign
 * rows before validation; beforeChange merges them back from the DB.
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
  if (orgAdminIds.length > 0) {
    return { id: { in: orgAdminIds } }
  }

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

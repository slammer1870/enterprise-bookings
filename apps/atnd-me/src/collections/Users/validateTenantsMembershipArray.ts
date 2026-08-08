import type { PayloadRequest } from 'payload'

import { resolveOrgAdminTenantIds } from '@/access/tenant-scoped'
import { isAdmin } from '@/access/userTenantAccess'
import { extractTenantId } from './tenantHookHelpers'

/**
 * Validate `users.tenants`:
 * - each tenant at most once
 * - org admins may only assign tenants they administer, and no more rows than
 *   that set (matching their own admin assignments)
 */
export async function validateTenantsMembershipArray(
  value: unknown,
  { req }: { req?: PayloadRequest },
): Promise<string | true> {
  if (!Array.isArray(value)) return true

  const ids = (value as { tenant?: unknown }[])
    .map((entry) => extractTenantId(entry?.tenant))
    .filter((id): id is number => id != null)

  if (new Set(ids).size !== ids.length) {
    return 'Each tenant may only be added once.'
  }

  const user = req?.user
  if (!user || isAdmin(user)) return true

  const orgAdminIds = await resolveOrgAdminTenantIds({
    user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  if (orgAdminIds.length === 0) return true

  // Count rows on the form (including empty tenant picks) so "Add Tenant" spam
  // cannot exceed the admin's own assignment count.
  if (value.length > orgAdminIds.length) {
    return `You can only assign up to ${orgAdminIds.length} tenant(s), matching your own assignments.`
  }

  const allowed = new Set(orgAdminIds)
  for (const id of ids) {
    if (!allowed.has(id)) {
      return 'You can only assign tenants you administer.'
    }
  }

  return true
}

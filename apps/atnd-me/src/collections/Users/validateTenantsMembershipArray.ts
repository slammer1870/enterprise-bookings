import type { PayloadRequest } from 'payload'

import { resolveOrgAdminTenantIds } from '@/access/tenant-scoped'
import { isAdmin } from '@/access/userTenantAccess'
import { extractTenantId } from './tenantHookHelpers'

/**
 * Validate `users.tenants` for org admins.
 *
 * Collection `beforeChange` re-merges foreign memberships from the DB before field
 * validation runs, so this validator only constrains rows the admin may edit
 * (tenants they administer + empty picks). Foreign rows are ignored here; strip +
 * mergeTenantEntriesForAdmin remain the write guards.
 */
export async function validateTenantsMembershipArray(
  value: unknown,
  { req }: { req?: PayloadRequest },
): Promise<string | true> {
  if (!Array.isArray(value)) return true

  const user = req?.user
  if (!user || isAdmin(user)) {
    const ids = (value as { tenant?: unknown }[])
      .map((entry) => extractTenantId(entry?.tenant))
      .filter((id): id is number => id != null)
    if (new Set(ids).size !== ids.length) {
      return 'Each tenant may only be added once.'
    }
    return true
  }

  const orgAdminIds = await resolveOrgAdminTenantIds({
    user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  if (orgAdminIds.length === 0) {
    const ids = (value as { tenant?: unknown }[])
      .map((entry) => extractTenantId(entry?.tenant))
      .filter((id): id is number => id != null)
    if (new Set(ids).size !== ids.length) {
      return 'Each tenant may only be added once.'
    }
    return true
  }

  const allowed = new Set(orgAdminIds)
  // Rows the admin is responsible for on the form (including empty tenant picks).
  // Foreign rows re-merged from DB are excluded from the cap.
  const editableRows = (value as { tenant?: unknown }[]).filter((entry) => {
    const tid = extractTenantId(entry?.tenant)
    return tid == null || allowed.has(tid)
  })

  if (editableRows.length > orgAdminIds.length) {
    return `You can only assign up to ${orgAdminIds.length} tenant(s), matching your own assignments.`
  }

  const editableIds = editableRows
    .map((entry) => extractTenantId(entry?.tenant))
    .filter((id): id is number => id != null)

  if (new Set(editableIds).size !== editableIds.length) {
    return 'Each tenant may only be added once.'
  }

  return true
}

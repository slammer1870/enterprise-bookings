import type { PayloadRequest } from 'payload'

import { resolveOrgAdminTenantIds } from '@/access/tenant-scoped'
import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'
import { extractTenantId, type TenantEntry } from './tenantHookHelpers'

/**
 * Strip foreign tenant memberships from submitted data before relationship validation.
 * Restored via fixBetterAuthUsersHooks because payload-auth drops `beforeValidate`.
 */
export async function stripForeignTenantsBeforeValidate({
  data,
  req,
}: {
  data?: Record<string, unknown> | null
  req: PayloadRequest
}): Promise<Record<string, unknown> | null | undefined> {
  if (!data) return data
  if (!req.user || isAdmin(req.user)) return data
  if (!isTenantAdmin(req.user)) return data

  const tenants = data.tenants
  if (!Array.isArray(tenants)) return data

  const adminTenantIds = await resolveOrgAdminTenantIds({
    user: req.user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  if (adminTenantIds.length === 0) return data

  data.tenants = tenants.filter((e) => {
    const tid = extractTenantId((e as TenantEntry)?.tenant)
    return tid != null && adminTenantIds.includes(tid)
  })

  return data
}

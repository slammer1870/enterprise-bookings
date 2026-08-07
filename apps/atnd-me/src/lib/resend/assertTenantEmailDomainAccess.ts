import type { BasePayload } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'
import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'

/**
 * Auth + tenant ownership check for email-domain status/verify APIs.
 * Returns the authorized tenant id or an error response payload.
 */
export async function assertTenantEmailDomainAccess(args: {
  payload: BasePayload
  headers: Headers
  tenantIdParam: string | null
}): Promise<
  | { ok: true; tenantId: number; user: SharedUser }
  | { ok: false; status: number; error: string }
> {
  const { payload, headers, tenantIdParam } = args
  const authResult = await payload.auth({ headers })
  let user = (authResult?.user as SharedUser) ?? null

  if (!user || (!isAdmin(user) && !isTenantAdmin(user))) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const userId = user.id != null ? Number(user.id) : NaN
  if (isTenantAdmin(user) && !isAdmin(user) && Number.isFinite(userId)) {
    const fullUser = await payload
      .findByID({
        collection: 'users',
        id: userId,
        depth: 2,
        overrideAccess: true,
        select: { id: true, role: true, tenants: true, registrationTenant: true } as any,
      })
      .catch(() => null)
    if (fullUser) user = fullUser as unknown as SharedUser
  }

  const requestedId = tenantIdParam != null && tenantIdParam !== '' ? Number(tenantIdParam) : NaN
  if (!Number.isFinite(requestedId)) {
    return { ok: false, status: 400, error: 'tenantId is required' }
  }

  if (isAdmin(user)) {
    return { ok: true, tenantId: requestedId, user }
  }

  let tenantIds = getUserTenantIds(user)
  if (tenantIds === null || tenantIds.length === 0) {
    const reg = (user as unknown as { registrationTenant?: number | { id: number } })
      .registrationTenant
    const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
    if (typeof tid === 'number') tenantIds = [tid]
  }

  if (!tenantIds || !tenantIds.map(Number).includes(requestedId)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, tenantId: requestedId, user }
}

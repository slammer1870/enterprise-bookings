import type { Access, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { getUserTenantIds } from './tenant-scoped'

/** True if user is admin (checks both roles[] and role[] from Better Auth). */
export function isAdmin(u: unknown): boolean {
  if (checkRole(['admin'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role) && role.includes('admin')) return true
  if (role === 'admin') return true
  return false
}

/** True if user is tenant-admin (checks both roles[] and role[] from Better Auth). */
export function isTenantAdmin(u: unknown): boolean {
  if (checkRole(['tenant-admin'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role) && role.includes('tenant-admin')) return true
  if (role === 'tenant-admin') return true
  return false
}

/**
 * Coerce user id to number (session/auth may provide string).
 */
function toUserId(user: unknown): number | null {
  if (user == null) return null
  if (typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string') {
      const n = parseInt(id, 10)
      return Number.isFinite(n) ? n : null
    }
  }
  if (typeof user === 'number' && Number.isFinite(user)) return user
  return null
}

/**
 * For tenant-admins, req.user may come from the session without the `tenants`
 * relationship populated. Fetch the full user from the database so we can resolve
 * their tenant IDs and show users who belong to them or have bookings with them.
 */
async function getTenantAdminUserWithTenants(
  user: unknown,
  payload: { findByID: (args: { collection: 'users'; id: number; depth?: number; overrideAccess?: boolean }) => Promise<unknown> },
): Promise<SharedUser | null> {
  const userId = toUserId(user)
  if (userId == null) return null
  const full = await payload
    .findByID({
      collection: 'users',
      id: userId,
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => null)
  return full as SharedUser | null
}

/**
 * Resolve the tenant ID from req.context (e.g. selected tenant in admin or subdomain).
 * Returns a number or null if not set / invalid.
 */
function getContextTenantId(req: { context?: { tenant?: unknown } }): number | null {
  const raw = req?.context?.tenant
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string') {
      const n = parseInt(id, 10)
      return Number.isFinite(n) ? n : null
    }
  }
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * User read access for multi-tenant apps.
 *
 * - Super admin: can read all users (no query filter)
 * - Tenant admin: can only read users for their domain(s) (tenant = domain):
 *   - Users who registered at their domain (registrationTenant in tenant IDs)
 *   - Users who have a booking at their domain
 *   - The tenant-admin themselves
 *   When req.context.tenant is set (e.g. tenant selected in admin), scope to that domain only.
 * - Regular user: can only read themselves
 */
export const userTenantRead: Access = async ({ req }) => {
  const { user, payload } = req
  if (!user) return false

  if (isAdmin(user)) {
    return true
  }

  if (isTenantAdmin(user)) {
    let tenantIds = getUserTenantIds(user as unknown as SharedUser)
    let fullUser: SharedUser | null = null
    // Session user may not have tenants populated; fetch full user so we can resolve tenant IDs
    if (tenantIds !== null && tenantIds.length === 0) {
      fullUser = await getTenantAdminUserWithTenants(user, payload)
      if (fullUser) tenantIds = getUserTenantIds(fullUser)
    }
    // Fallback: tenants relation may be empty from join table; use registrationTenant for tenant-admin
    if (tenantIds !== null && tenantIds.length === 0) {
      const u = fullUser ?? (await getTenantAdminUserWithTenants(user, payload)) ?? user
      const reg = (u as unknown as { registrationTenant?: number | { id: number } }).registrationTenant
      const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
      if (typeof tid === 'number') tenantIds = [tid]
    }
    if (tenantIds === null || tenantIds.length === 0) return false

    // When a specific tenant (domain) is selected in context, scope to that domain only
    const contextTenantId = getContextTenantId(req as { context?: { tenant?: unknown } })
    const effectiveTenantIds =
      contextTenantId != null && tenantIds.includes(contextTenantId)
        ? [contextTenantId]
        : tenantIds

    const userId = toUserId(user)
    if (userId == null) return false

    const orClauses: Where['or'] = [
      { registrationTenant: { in: effectiveTenantIds } },
      { id: { equals: userId } },
    ]

    const bookingsWithTenant = await payload.find({
      collection: 'bookings',
      where: { tenant: { in: effectiveTenantIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      select: { user: true } as any,
    })
    const userIdsWithBookings = [
      ...new Set(
        bookingsWithTenant.docs
          .map((b) => (typeof b.user === 'object' && b.user != null && 'id' in b.user ? (b.user as { id: number }).id : b.user))
          .filter((id): id is number => typeof id === 'number')
      ),
    ]
    if (userIdsWithBookings.length > 0) {
      orClauses.push({ id: { in: userIdsWithBookings } })
    }

    const where: Where = { or: orClauses }
    return where
  }

  // Regular user: can only read themselves
  const readUserId = toUserId(user)
  if (readUserId == null) return false
  const where: Where = { id: { equals: readUserId } }
  return where
}

/**
 * User update access for multi-tenant apps.
 *
 * - Super admin: can update any user
 * - Tenant admin: can only update users for their domain(s) (tenant = domain):
 *   - Users who registered at their domain, or have a booking at their domain, or themselves
 *   When req.context.tenant is set, scope to that domain only.
 * - Regular user: can only update themselves
 */
export const userTenantUpdate: Access = async ({ req, id }) => {
  const { user, payload } = req
  if (!user) return false

  if (isAdmin(user)) {
    return true
  }

  if (isTenantAdmin(user)) {
    let tenantIds = getUserTenantIds(user as unknown as SharedUser)
    let fullUser: SharedUser | null = null
    // Session user may not have tenants populated; fetch full user so we can resolve tenant IDs
    if (tenantIds !== null && tenantIds.length === 0) {
      fullUser = await getTenantAdminUserWithTenants(user, payload)
      if (fullUser) tenantIds = getUserTenantIds(fullUser)
    }
    // Fallback: tenants relation may be empty from join table; use registrationTenant for tenant-admin
    if (tenantIds !== null && tenantIds.length === 0) {
      const u = fullUser ?? (await getTenantAdminUserWithTenants(user, payload)) ?? user
      const reg = (u as unknown as { registrationTenant?: number | { id: number } }).registrationTenant
      const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
      if (typeof tid === 'number') tenantIds = [tid]
    }
    if (tenantIds === null || tenantIds.length === 0) return false

    // When a specific tenant (domain) is selected in context, scope to that domain only
    const contextTenantId = getContextTenantId(req as { context?: { tenant?: unknown } })
    const effectiveTenantIds =
      contextTenantId != null && tenantIds.includes(contextTenantId)
        ? [contextTenantId]
        : tenantIds

    const userId = toUserId(user)
    if (userId == null) return false

    const orClauses: Where['or'] = [
      { registrationTenant: { in: effectiveTenantIds } },
      { id: { equals: userId } },
    ]

    const bookingsWithTenant = await payload.find({
      collection: 'bookings',
      where: { tenant: { in: effectiveTenantIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      select: { user: true } as any,
    })
    const userIdsWithBookings = [
      ...new Set(
        bookingsWithTenant.docs
          .map((b) => (typeof b.user === 'object' && b.user != null && 'id' in b.user ? (b.user as { id: number }).id : b.user))
          .filter((id): id is number => typeof id === 'number')
      ),
    ]
    if (userIdsWithBookings.length > 0) {
      orClauses.push({ id: { in: userIdsWithBookings } })
    }

    const where: Where = { or: orClauses }
    return where
  }

  // Regular user: can only update themselves
  const updateUserId = toUserId(user)
  if (updateUserId == null) return false
  const targetId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : null
  return targetId != null && targetId === updateUserId
}

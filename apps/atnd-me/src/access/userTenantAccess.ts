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
 * For tenant-admins, req.user may come from the session without the `tenants`
 * relationship populated. Fetch the full user from the database so we can resolve
 * their tenant IDs and show users who belong to them or have bookings with them.
 */
async function getTenantAdminUserWithTenants(
  user: unknown,
  payload: { findByID: (args: { collection: 'users'; id: number; depth?: number; overrideAccess?: boolean }) => Promise<unknown> },
): Promise<SharedUser | null> {
  const userId = typeof user === 'object' && user !== null && 'id' in user
    ? (user as { id: number }).id
    : (user as number)
  const full = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 1,
    overrideAccess: true,
  })
  return full as SharedUser | null
}

/**
 * User read access for multi-tenant apps.
 *
 * - Super admin: can read all users (no query filter)
 * - Tenant admin: can only read users in their assigned tenant
 *   - Users who registered with tenant (registrationTenant in tenant IDs)
 *   - Users who have previously made a booking with tenant
 *   - The tenant-admin themselves
 * - Regular user: can only read themselves
 */
export const userTenantRead: Access = async ({ req: { user, payload } }) => {
  if (!user) return false

  if (isAdmin(user)) {
    return true
  }

  if (isTenantAdmin(user)) {
    let tenantIds = getUserTenantIds(user as unknown as SharedUser)
    // Session user may not have tenants populated; fetch full user so we can resolve tenant IDs
    if (tenantIds !== null && tenantIds.length === 0) {
      const fullUser = await getTenantAdminUserWithTenants(user, payload)
      if (fullUser) tenantIds = getUserTenantIds(fullUser)
    }
    if (tenantIds === null || tenantIds.length === 0) return false

    const userId = typeof user === 'object' && user !== null && 'id' in user
      ? (user as { id: number }).id
      : (user as number)

    const orClauses: Where['or'] = [
      { registrationTenant: { in: tenantIds } },
      { id: { equals: userId } },
    ]

    const bookingsWithTenant = await payload.find({
      collection: 'bookings',
      where: { tenant: { in: tenantIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
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
  const readUserId = typeof user === 'object' && user !== null && 'id' in user
    ? (user as { id: number }).id
    : (user as number)
  const where: Where = { id: { equals: readUserId } }
  return where
}

/**
 * User update access for multi-tenant apps.
 *
 * - Super admin: can update any user
 * - Tenant admin: can only update users in their assigned tenant
 *   (registrationTenant, or users who have a booking with tenant, or themselves)
 * - Regular user: can only update themselves
 */
export const userTenantUpdate: Access = async ({ req: { user, payload }, id }) => {
  if (!user) return false

  if (isAdmin(user)) {
    return true
  }

  if (isTenantAdmin(user)) {
    let tenantIds = getUserTenantIds(user as unknown as SharedUser)
    // Session user may not have tenants populated; fetch full user so we can resolve tenant IDs
    if (tenantIds !== null && tenantIds.length === 0) {
      const fullUser = await getTenantAdminUserWithTenants(user, payload)
      if (fullUser) tenantIds = getUserTenantIds(fullUser)
    }
    if (tenantIds === null || tenantIds.length === 0) return false

    const userId = typeof user === 'object' && user !== null && 'id' in user
      ? (user as { id: number }).id
      : (user as number)

    const orClauses: Where['or'] = [
      { registrationTenant: { in: tenantIds } },
      { id: { equals: userId } },
    ]

    const bookingsWithTenant = await payload.find({
      collection: 'bookings',
      where: { tenant: { in: tenantIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
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
  const updateUserId = typeof user === 'object' && user !== null && 'id' in user
    ? (user as { id: number }).id
    : (user as number)
  return id === updateUserId
}

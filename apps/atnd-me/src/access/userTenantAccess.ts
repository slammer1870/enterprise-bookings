import type { Access, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { getUserTenantIds } from './tenant-scoped'

/**
 * User read access for multi-tenant apps.
 *
 * - Super admin: can read all users (no query filter)
 * - Tenant admin: can only read users in their assigned tenant
 *   (registrationTenant in their tenant IDs, or themselves)
 * - Regular user: can only read themselves
 */
export const userTenantRead: Access = ({ req: { user } }) => {
  if (!user) return false

  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }

  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false

    const userId = typeof user === 'object' && user !== null && 'id' in user
      ? (user as { id: number }).id
      : (user as number)

    const where: Where = {
      or: [
        { registrationTenant: { in: tenantIds } },
        { id: { equals: userId } },
      ],
    }
    return where
  }

  // Regular user: can only read themselves
  const readUserId = typeof user === 'object' && user !== null && 'id' in user
    ? (user as { id: number }).id
    : (user as number)
  return {
    id: { equals: readUserId },
  }
}

/**
 * User update access for multi-tenant apps.
 *
 * - Super admin: can update any user
 * - Tenant admin: can only update users in their assigned tenant
 * - Regular user: can only update themselves
 */
export const userTenantUpdate: Access = ({ req: { user }, id }) => {
  if (!user) return false

  if (checkRole(['admin'], user as unknown as SharedUser)) {
    return true
  }

  if (checkRole(['tenant-admin'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false

    const userId = typeof user === 'object' && user !== null && 'id' in user
      ? (user as { id: number }).id
      : (user as number)

    const where: Where = {
      or: [
        { registrationTenant: { in: tenantIds } },
        { id: { equals: userId } },
      ],
    }
    return where
  }

  // Regular user: can only update themselves
  const userId = typeof user === 'object' && user !== null && 'id' in user
    ? (user as { id: number }).id
    : (user as number)
  return id === userId
}

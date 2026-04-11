import type { Access, Where } from 'payload'

import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import {
  resolveTenantAdminReadConstraint,
  resolveTenantIdFromRequest,
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedUpdate,
  type RequestLike,
} from './tenant-scoped'

async function publishedVisibilityForPublic(req: RequestLike): Promise<Where> {
  const published: Where = { _status: { equals: 'published' } }
  const tenantId = await resolveTenantIdFromRequest(req)
  if (tenantId != null) {
    return {
      and: [published, { tenant: { equals: tenantId } }],
    } as Where
  }
  return {
    and: [published, { tenant: { equals: null } }],
  } as Where
}

/**
 * Blog posts: published content is scoped by site tenant (subdomain / host).
 * Platform root shows only posts with no tenant; tenant sites see only that tenant's posts.
 * Staff/super-admin rules align with other tenant-scoped collections.
 */
export const postsRead: Access = async ({ req }) => {
  const user = req.user

  if (user && checkRole(['super-admin'], user as unknown as SharedUser)) {
    const resolvedTenantId = await resolveTenantIdFromRequest(req as RequestLike)
    if (resolvedTenantId != null) {
      return {
        tenant: {
          equals: resolvedTenantId,
        },
      } as Where
    }
    return true
  }

  if (user && checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    return await resolveTenantAdminReadConstraint({ req })
  }

  return await publishedVisibilityForPublic(req as RequestLike)
}

/**
 * Tenant admins must not create platform-wide (null tenant) posts via API.
 * The admin UI also enforces a tenant via clearableTenantPlugin; this closes the API gap.
 */
export const postsCreate: Access = async (args) => {
  const { req, data } = args
  const user = req.user
  if (!user) return false

  if (checkRole(['super-admin'], user as unknown as SharedUser)) {
    return tenantScopedCreate(args)
  }

  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    if (data && Object.prototype.hasOwnProperty.call(data as object, 'tenant')) {
      const t = (data as { tenant?: unknown }).tenant
      if (t === null || t === undefined || t === '') {
        return false
      }
    }
  }

  return tenantScopedCreate(args)
}

export const postsUpdate = tenantScopedUpdate
export const postsDelete = tenantScopedDelete

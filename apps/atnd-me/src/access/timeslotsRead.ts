import type { Access, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'
import { tenantScopedPublicReadStrict } from './tenant-scoped'
import { resolveTenantAdminReadConstraint, resolveTenantIdFromRequest } from './tenant-scoped'

/**
 * Timeslots read access:
 * - Admin / tenant-admin: unchanged (full visibility per existing tenant scoping rules)
 * - Authenticated regular users: unchanged
 * - Public: do not expose inactive timeslots
 *
 * NOTE: We intentionally do NOT filter by endTime here. The rule is
 * "users can see all of today's timeslots (even after they end) but not
 * yesterday's timeslots or earlier". That boundary is date- and timezone-
 * dependent; the getByDate tRPC router handles it correctly using the
 * tenant's timezone. Filtering by `endTime >= now` here would incorrectly
 * hide timeslots that started earlier today, breaking the full-day schedule view.
 */
export const timeslotsRead: Access = async (args) => {
  const user = args.req.user as unknown as SharedUser | undefined | null

  // Super-admin sees everything.
  if (user && checkRole(['super-admin'], user as any)) {
    return true
  }

  // Tenant-admin/staff:
  // - For booking routes we want to allow cross-tenant booking when the request resolves
  //   a specific tenant from host/cookies.
  // - For admin list queries (no tenant context), fall back to strict assigned-tenant scoping.
  if (user && checkRole(['admin', 'staff'], user as any)) {
    const resolvedTenantId = await resolveTenantIdFromRequest(args.req as any)
    if (resolvedTenantId != null) {
      return { tenant: { equals: resolvedTenantId } } as Where
    }

    return resolveTenantAdminReadConstraint({ req: args.req as any })
  }

  // Regular users/public:
  // - resolve tenant from request context/cookies
  // - deny if none (prevents cross-tenant leaks)
  const base = await tenantScopedPublicReadStrict(args)
  if (base === false) return false

  if (user) return base

  const publicVisibilityConstraint: Where = {
    active: {
      equals: true,
    },
  }

  if (base === true) {
    return publicVisibilityConstraint
  }

  return {
    and: [
      base,
      publicVisibilityConstraint,
    ],
  }
}

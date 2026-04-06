import type { Access, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { tenantScopedPublicReadStrict } from './tenant-scoped'

/**
 * Lessons read access:
 * - Admin / tenant-admin: unchanged (full visibility per existing tenant scoping rules)
 * - Authenticated regular users: unchanged
 * - Public: do not expose inactive lessons
 *
 * NOTE: We intentionally do NOT filter by endTime here. The rule is
 * "users can see all of today's lessons (even after they end) but not
 * yesterday's lessons or earlier". That boundary is date- and timezone-
 * dependent; the getByDate tRPC router handles it correctly using the
 * tenant's timezone. Filtering by `endTime >= now` here would incorrectly
 * hide lessons that started earlier today, breaking the full-day schedule view.
 */
export const lessonsRead: Access = async (args) => {
  const base = await tenantScopedPublicReadStrict(args)
  if (base === false) return false

  const user = args.req.user as unknown as SharedUser | undefined | null
  if (user) {
    return base
  }

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

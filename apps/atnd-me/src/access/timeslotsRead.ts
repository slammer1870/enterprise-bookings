import type { Access, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { tenantScopedPublicReadStrict } from './tenant-scoped'

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

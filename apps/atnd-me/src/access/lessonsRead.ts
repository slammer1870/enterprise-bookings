import type { Access, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { tenantScopedPublicReadStrict } from './tenant-scoped'

/**
 * Lessons read access:
 * - Admin / tenant-admin: unchanged (full visibility per existing tenant scoping rules)
 * - Authenticated regular users: unchanged
 * - Public: do not allow reading lessons that have already ended and do not
 *   expose inactive lessons
 *
 * This prevents “past lessons” and inactive lessons from being visible in client-facing schedule views
 * without relying on each API layer to remember to filter.
 */
export const lessonsRead: Access = async (args) => {
  const base = await tenantScopedPublicReadStrict(args)
  if (base === false) return false

  const user = args.req.user as unknown as SharedUser | undefined | null
  if (user) {
    return base
  }

  const nowIso = new Date().toISOString()

  const publicVisibilityConstraint: Where = {
    and: [
      {
        endTime: {
          greater_than_equal: nowIso,
        },
      },
      {
        active: {
          equals: true,
        },
      },
    ],
  }

  // Merge base constraint (if any) with the public visibility constraints
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


import type { Access } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { tenantScopedReadFiltered } from './tenant-scoped'

/**
 * Lessons read access:
 * - Admin / tenant-admin: unchanged (full visibility per existing tenant scoping rules)
 * - Regular user / public: do not allow reading lessons that have already ended
 *
 * This prevents “past lessons” from being visible in client-facing schedule views
 * without relying on each API layer to remember to filter.
 */
export const lessonsRead: Access = async (args) => {
  const base = await tenantScopedReadFiltered(args)
  if (base === false) return false

  const user = args.req.user as unknown as SharedUser | undefined | null
  if (user && checkRole(['admin', 'tenant-admin'], user)) {
    return base
  }

  const nowIso = new Date().toISOString()

  // Merge base constraint (if any) with the "not ended yet" constraint
  if (base === true) {
    return {
      endTime: {
        greater_than_equal: nowIso,
      },
    }
  }

  return {
    and: [
      base,
      {
        endTime: {
          greater_than_equal: nowIso,
        },
      },
    ],
  }
}


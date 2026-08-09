import type {
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
} from 'payload'

/** Context key set by `markPasswordResetOperation` for `preserveTenantsOnPasswordReset`. */
export const ATND_PASSWORD_RESET_CTX = 'atndPasswordReset' as const

/**
 * Mark the request when Payload's `resetPassword` operation runs.
 * `resetPasswordOperation` calls `beforeOperation` with `operation: 'resetPassword'`,
 * then `beforeValidate` with `operation: 'update'` — so we need this flag to scope
 * the guard to the token-based reset path only.
 *
 * Register via `fix-better-auth-after-read-hooks.ts` (payload-auth drops
 * `beforeOperation` on Users).
 */
export const markPasswordResetOperation: CollectionBeforeOperationHook = ({
  args,
  operation,
  req,
}) => {
  if (operation === 'resetPassword') {
    req.context = {
      ...(req.context as Record<string, unknown> | undefined),
      [ATND_PASSWORD_RESET_CTX]: true,
    }
  }
  return args
}

/**
 * Pin a field so every read returns a fresh deep clone of `value`, and writes
 * are ignored. Needed because:
 * 1. `resetPasswordOperation` calls `db.updateOne` with the full user doc
 * 2. Drizzle's write transformer mutates array rows in place
 * 3. `addSessionToUser` then calls `db.updateOne` again with the same object
 *    (no beforeValidate) — so a one-shot assignment gets corrupted before the
 *    second write and join rows are wiped.
 */
function pinClonedField(target: Record<string, unknown>, key: string, value: unknown): void {
  const snapshot = structuredClone(value)
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      return structuredClone(snapshot)
    },
    set() {
      // Ignore in-place / reassignment mutations from the write transformer.
    },
  })
}

/**
 * Guard: prevent tenant memberships from being wiped during Payload's
 * `resetPasswordOperation` (raw `db.updateOne` path that bypasses beforeChange).
 *
 * Companion fix: `sanitizeUserTenantsAndRolesForWrite` must also preserve
 * memberships on anonymous public HTTP *updates* (forgot-password token write),
 * otherwise tenants are already empty by the time this hook runs.
 */
export const preserveTenantsOnPasswordReset: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (!data) return data
  if (operation !== 'update') return data
  if (!(req.context as Record<string, unknown> | undefined)?.[ATND_PASSWORD_RESET_CTX]) {
    return data
  }

  const record = data as Record<string, unknown>
  const userId = record.id
  if (userId == null) return data

  try {
    const existing = await req.payload.findByID({
      collection: 'users',
      id: userId as string | number,
      depth: 0,
      overrideAccess: true,
      context: { [ATND_PASSWORD_RESET_CTX]: false },
    })
    const doc = existing as unknown as Record<string, unknown> | null
    if (!doc) return data

    if (Array.isArray(doc.tenants)) {
      pinClonedField(record, 'tenants', doc.tenants)
    }
    if (Array.isArray(doc.locations)) {
      pinClonedField(record, 'locations', doc.locations)
    }
    if (doc.role !== undefined) {
      pinClonedField(record, 'role', doc.role)
    }
  } catch {
    // Best-effort: never block the password reset itself.
  }

  return data
}

/**
 * Pure helper functions extracted from Users collection hooks for testability.
 * These functions contain no Payload/DB dependencies and can be unit-tested in isolation.
 */

export type TenantEntry = {
  tenant: unknown
  roles?: unknown[]
  [key: string]: unknown
}

/** Coerce a raw tenant value (number | string | { id } | object) to a numeric ID. */
export function extractTenantId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return parseInt(raw, 10)
  return null
}

/**
 * Filter a user doc's `tenants` and `registrationTenant` fields to only entries
 * that belong to the given admin's tenant IDs.
 *
 * Used in the `afterRead` hook to prevent tenant admins from seeing other tenants'
 * membership rows when viewing a cross-tenant user.
 */
export function filterTenantsForTenantAdmin({
  doc,
  adminTenantIds,
}: {
  doc: Record<string, unknown>
  adminTenantIds: number[]
}): Record<string, unknown> {
  const result = { ...doc }
  const idSet = new Set(adminTenantIds)

  if (Array.isArray(doc.tenants)) {
    result.tenants = (doc.tenants as TenantEntry[]).filter((entry) => {
      const tid = extractTenantId(entry?.tenant)
      return tid != null && idSet.has(tid)
    })
  }

  if (doc.registrationTenant !== undefined && doc.registrationTenant !== null) {
    const regId = extractTenantId(doc.registrationTenant)
    if (regId == null || !idSet.has(regId)) {
      result.registrationTenant = null
    }
  }

  return result
}

/**
 * Merge incoming `tenants` data (submitted by a tenant admin) with the DB state for
 * tenants outside the admin's scope.
 *
 * Rules:
 * - Own-tenant entries: take from `incoming` (admin is allowed to edit these)
 * - Foreign-tenant entries: preserve from `dbTenants` (admin cannot touch these)
 * - Admin cannot inject new entries for tenants they don't control
 *
 * Used in the `beforeChange` hook write guard.
 */
export function mergeTenantEntriesForAdmin({
  incoming,
  adminTenantIds,
  dbTenants,
}: {
  incoming: TenantEntry[]
  adminTenantIds: number[]
  dbTenants: TenantEntry[]
}): TenantEntry[] {
  const adminSet = new Set(adminTenantIds)

  const ownFromIncoming = incoming.filter((e) => {
    const tid = extractTenantId(e?.tenant)
    return tid != null && adminSet.has(tid)
  })

  const foreignFromDb = dbTenants.filter((e) => {
    const tid = extractTenantId(e?.tenant)
    return tid == null || !adminSet.has(tid)
  })

  return [...ownFromIncoming, ...foreignFromDb]
}

const ROLE_PRIORITY = ['admin', 'staff', 'location-manager', 'user'] as const

/**
 * Derive the canonical global `role` value from a user's `tenants[n].roles` entries.
 *
 * - Picks the highest-priority role across all tenant entries.
 * - Defaults to `['user']` when no roles are found.
 * - Preserves `['super-admin']` unchanged — super-admin is never in per-tenant roles.
 *
 * Used in the `beforeChange` hook to keep `data.role` (JWT fast-path) in sync with
 * the authoritative per-tenant role assignments.
 */
export function deriveRoleFromTenants(
  tenants: TenantEntry[],
  existingRoles: string[],
): string[] {
  if (existingRoles.includes('super-admin')) return existingRoles

  const allRoles = tenants.flatMap((e) => (Array.isArray(e.roles) ? (e.roles as string[]) : []))
  const highest = ROLE_PRIORITY.find((r) => allRoles.includes(r)) ?? 'user'
  return [highest]
}

import type { Payload } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

/**
 * Site / branch manager: `location-manager` only (no org `admin`, `staff`, or platform `super-admin`).
 * Dual-role users follow the broader role’s access paths.
 */
export function isPureLocationManager(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const u = user as SharedUser
  if (!checkRole(['location-manager'], u)) return false
  if (checkRole(['super-admin', 'admin', 'staff'], u)) return false
  return true
}

function userIdFromUser(user: unknown): number | null {
  if (!user || typeof user !== 'object' || !('id' in user)) return null
  const id = (user as { id: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

/** Coerce relationship / number / string ids from Payload data or populated docs. */
export function relationIdFromPayloadField(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

type TenantMembershipRow = {
  tenant?: unknown
  roles?: unknown
  locations?: unknown
}

/**
 * Branch scope from `tenants[].locations` for staff / location-manager rows.
 * - `unrestricted`: admin on the tenant, or staff/LM with empty locations (= all locations)
 * - `ids`: non-empty assignment list
 */
export type BranchAssignmentScope =
  | { kind: 'unrestricted' }
  | { kind: 'ids'; ids: number[] }

function rolesFromEntry(entry: TenantMembershipRow): string[] {
  if (!Array.isArray(entry.roles)) return []
  return entry.roles.filter((r): r is string => typeof r === 'string')
}

/**
 * Resolve branch assignment scope for the given tenant ids from a user doc's `tenants[]`.
 */
export function branchScopeForUserInTenants(
  userDoc: unknown,
  tenantIds: number[],
): BranchAssignmentScope {
  if (!tenantIds.length) return { kind: 'ids', ids: [] }
  const set = new Set(tenantIds)
  const tenants = (userDoc as { tenants?: TenantMembershipRow[] })?.tenants
  if (!Array.isArray(tenants)) return { kind: 'unrestricted' }

  const assigned = new Set<number>()
  let sawScopedRow = false
  let sawUnrestrictedRow = false

  for (const entry of tenants) {
    const tid = relationIdFromPayloadField(entry?.tenant)
    if (tid == null || !set.has(tid)) continue
    const roles = rolesFromEntry(entry)
    if (roles.includes('admin')) {
      sawUnrestrictedRow = true
      continue
    }
    if (!roles.includes('staff') && !roles.includes('location-manager')) continue

    const locs = entry.locations
    if (!Array.isArray(locs) || locs.length === 0) {
      sawUnrestrictedRow = true
      continue
    }
    sawScopedRow = true
    for (const loc of locs) {
      const bid = relationIdFromPayloadField(loc)
      if (bid != null) assigned.add(bid)
    }
  }

  if (sawUnrestrictedRow && !sawScopedRow) return { kind: 'unrestricted' }
  if (sawUnrestrictedRow && sawScopedRow) {
    // Mixed: prefer unrestricted if any matching tenant row is unrestricted
    // when querying multiple tenants; for single-tenant calls this won't mix.
    if (tenantIds.length === 1) {
      // Re-evaluate single tenant more carefully — already handled above per-row.
      // If both somehow true for one tenant, unrestricted wins (admin or empty).
      return { kind: 'unrestricted' }
    }
    return { kind: 'unrestricted' }
  }
  if (sawScopedRow) return { kind: 'ids', ids: [...assigned] }
  // No staff/LM/admin row for these tenants — unrestricted (caller decides)
  return { kind: 'unrestricted' }
}

/**
 * Assigned branch ids from `tenants[].locations` (empty assignment / admin → []).
 * Prefer {@link branchScopeForUserInTenants} when empty means all locations.
 */
export function branchIdsForUserInTenants(userDoc: unknown, tenantIds: number[]): number[] {
  const scope = branchScopeForUserInTenants(userDoc, tenantIds)
  if (scope.kind === 'unrestricted') return []
  return scope.ids
}

/**
 * Hydrate user for branch scoping (`tenants` + nested locations).
 */
export async function loadUserForLocationAssignments(
  payload: Payload,
  userId: number,
): Promise<unknown | null> {
  return payload
    .findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
}

/**
 * Resolve assigned branch ids for a pure location-manager (or staff with assignments).
 * Returns `null` when unrestricted (empty locations / admin) within the given tenants.
 * Returns `number[]` when scoped (may be empty if assignments are orphaned).
 */
export async function resolveBranchAssignmentScope(args: {
  payload: Payload
  user: unknown
  tenantIds: number[]
}): Promise<BranchAssignmentScope> {
  const { payload, user, tenantIds } = args
  if (!tenantIds.length) return { kind: 'ids', ids: [] }
  const uid = userIdFromUser(user)
  if (uid == null) return { kind: 'ids', ids: [] }

  const rawDoc = await loadUserForLocationAssignments(payload, uid)
  if (!rawDoc) return { kind: 'ids', ids: [] }

  const scope = branchScopeForUserInTenants(rawDoc, tenantIds)
  if (scope.kind === 'unrestricted') return scope
  if (!scope.ids.length) return { kind: 'ids', ids: [] }

  // Verify location rows belong to the requested tenants
  const found = await payload
    .find({
      collection: 'locations',
      where: { id: { in: scope.ids } },
      limit: scope.ids.length,
      depth: 0,
      overrideAccess: true,
      select: { id: true, tenant: true } as any,
    })
    .catch(() => null)

  if (!found) return { kind: 'ids', ids: [] }
  const set = new Set(tenantIds)
  const out: number[] = []
  for (const loc of found.docs as Array<{ id?: unknown; tenant?: unknown }>) {
    const locId = relationIdFromPayloadField(loc.id)
    if (locId == null) continue
    const tid = relationIdFromPayloadField(loc.tenant)
    if (tid != null && set.has(tid)) out.push(locId)
  }
  return { kind: 'ids', ids: [...new Set(out)] }
}

/**
 * @deprecated Prefer {@link resolveBranchAssignmentScope}. Returns [] when unrestricted
 * (callers that treated empty as "no access" must migrate).
 */
export async function resolvePureLocationManagerBranchIds(args: {
  payload: Payload
  user: unknown
  tenantIds: number[]
}): Promise<number[]> {
  const scope = await resolveBranchAssignmentScope(args)
  if (scope.kind === 'unrestricted') return []
  return scope.ids
}

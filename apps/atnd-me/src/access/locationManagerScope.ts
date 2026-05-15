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

/**
 * Hydrate `users.locations` (depth 1, no select) for branch scoping.
 * Omitting `select` ensures Payload fully populates the locations relationship
 * including their `tenant` field at depth 1.
 */
export async function loadUserForLocationAssignments(
  payload: Payload,
  userId: number,
): Promise<unknown | null> {
  return payload
    .findByID({
      collection: 'users',
      id: userId,
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => null)
}

/**
 * Assigned `locations` row ids whose `tenant` is in `tenantIds`.
 * Handles both populated Location objects (depth ≥ 1) and raw IDs (depth 0).
 * When entries are raw IDs without a tenant field, falls back to a DB lookup.
 */
export function branchIdsForUserInTenants(userDoc: unknown, tenantIds: number[]): number[] {
  if (!tenantIds.length) return []
  const set = new Set(tenantIds)
  const locs = (userDoc as { locations?: unknown })?.locations
  if (!Array.isArray(locs)) return []
  const out: number[] = []
  for (const entry of locs) {
    const bid = relationIdFromPayloadField(entry)
    if (bid == null) continue
    const tenantVal =
      typeof entry === 'object' && entry !== null && 'tenant' in entry
        ? (entry as { tenant?: unknown }).tenant
        : null
    const tid = relationIdFromPayloadField(tenantVal)
    if (tid != null && set.has(tid)) {
      out.push(bid)
    }
  }
  return [...new Set(out)]
}

export async function resolvePureLocationManagerBranchIds(args: {
  payload: Payload
  user: unknown
  tenantIds: number[]
}): Promise<number[]> {
  const { payload, user, tenantIds } = args
  if (!tenantIds.length) return []
  const uid = userIdFromUser(user)
  if (uid == null) return []

  // Step 1: get the user's raw location IDs (depth 0; no select — join-table fields like
  // hasMany relationships may not be included when using `select` in Payload/Drizzle)
  const rawDoc = await payload
    .findByID({
      collection: 'users',
      id: uid,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!rawDoc) return []
  const rawLocs = (rawDoc as { locations?: unknown }).locations
  if (!Array.isArray(rawLocs) || rawLocs.length === 0) return []

  const locationIds: number[] = []
  for (const entry of rawLocs) {
    const id = relationIdFromPayloadField(entry)
    if (id != null) locationIds.push(id)
  }
  if (!locationIds.length) return []

  // Step 2: query the Locations collection to verify tenant associations
  const found = await payload
    .find({
      collection: 'locations',
      where: { id: { in: locationIds } },
      limit: locationIds.length,
      depth: 0,
      overrideAccess: true,
      select: { id: true, tenant: true } as any,
    })
    .catch(() => null)

  if (!found) return []
  const set = new Set(tenantIds)
  const out: number[] = []
  for (const loc of found.docs as Array<{ id?: unknown; tenant?: unknown }>) {
    const locId = relationIdFromPayloadField(loc.id)
    if (locId == null) continue
    const tid = relationIdFromPayloadField(loc.tenant)
    if (tid != null && set.has(tid)) {
      out.push(locId)
    }
  }
  return [...new Set(out)]
}

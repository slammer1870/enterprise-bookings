import type { Payload } from 'payload'
import type { Pool } from 'pg'

/** Request-scoped memo so repeated `access` evaluations in one HTTP request reuse one query. */
const CONTEXT_CACHE_KEY = '__distinctBookingUserIdsForTenants'

type DistinctIdsCache = Map<string, Promise<number[]>>

function getPgPool(payload: Payload): Pool | null {
  const db = payload.db
  if (
    db &&
    typeof db === 'object' &&
    'pool' in db &&
    db.pool &&
    typeof (db.pool as Pool).query === 'function'
  ) {
    return db.pool as Pool
  }
  return null
}

function normalizeTenantIds(tenantIds: number[]): number[] {
  return [...new Set(tenantIds.filter((id) => typeof id === 'number' && Number.isFinite(id)))]
}

async function distinctUserIdsViaSql(pool: Pool, tenantIds: number[]): Promise<number[]> {
  if (tenantIds.length === 0) return []

  const res = await pool.query<{ user_id: number }>(
    `SELECT DISTINCT "user_id" AS "user_id" FROM "bookings"
 WHERE "tenant_id" = ANY($1::int[]) AND "user_id" IS NOT NULL`,
    [tenantIds],
  )

  const ids = res.rows
    .map((r) => r.user_id)
    .filter((id) => typeof id === 'number' && Number.isFinite(id))
  return [...new Set(ids)]
}

/** Fallback if `pool` is unavailable (should not happen on atnd-me Postgres). */
async function distinctUserIdsViaPayloadFind(
  payload: Payload,
  tenantIds: number[],
): Promise<number[]> {
  if (tenantIds.length === 0) return []

  const bookingsWithTenant = await payload.find({
    collection: 'bookings',
    where: { tenant: { in: tenantIds } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    select: { user: true } as Record<string, boolean>,
  })

  return [
    ...new Set(
      bookingsWithTenant.docs
        .map((b) =>
          typeof b.user === 'object' && b.user != null && 'id' in b.user
            ? (b.user as { id: number }).id
            : (b.user as number | undefined),
        )
        .filter((id): id is number => typeof id === 'number'),
    ),
  ]
}

async function fetchDistinctUserIds(payload: Payload, tenantIds: number[]): Promise<number[]> {
  const uniq = normalizeTenantIds(tenantIds)
  if (uniq.length === 0) return []

  const pool = getPgPool(payload)
  if (pool) {
    return distinctUserIdsViaSql(pool, uniq)
  }
  return distinctUserIdsViaPayloadFind(payload, uniq)
}

/**
 * Distinct `users.id` values that have at least one booking row for the given tenant id(s).
 * Used by tenant-scoped Users collection access (replaces scanning up to 5000 booking docs).
 */
export function getDistinctBookingUserIdsForTenants(
  payload: Payload,
  tenantIds: number[],
  req?: { context?: Record<string, unknown> },
): Promise<number[]> {
  const uniq = normalizeTenantIds(tenantIds)
  if (uniq.length === 0) return Promise.resolve([])

  const cacheKey = uniq.slice().sort((a, b) => a - b).join(',')

  if (req?.context) {
    let map = req.context[CONTEXT_CACHE_KEY] as DistinctIdsCache | undefined
    if (!map) {
      map = new Map()
      req.context[CONTEXT_CACHE_KEY] = map
    }
    let pending = map.get(cacheKey)
    if (!pending) {
      pending = fetchDistinctUserIds(payload, uniq)
      map.set(cacheKey, pending)
    }
    return pending
  }

  return fetchDistinctUserIds(payload, uniq)
}

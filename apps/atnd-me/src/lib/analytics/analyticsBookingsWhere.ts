/**
 * Shared helpers for analytics: confirmed bookings whose timeslot (lesson) falls in the date range.
 * Date params are calendar YYYY-MM-DD and match timeslots.date, not booking createdAt.
 *
 * We resolve timeslot IDs first and filter bookings with `timeslot: { in: ids }` because
 * nested paths like `timeslot.date` on the bookings collection are not reliably supported
 * by the Postgres adapter (they can throw or mis-query at runtime).
 */
import type { Payload } from 'payload'
import type { Where } from 'payload'
import type { AnalyticsQueryParams } from './types'

const TIMESLOT_PAGE_SIZE = 500
/** Keep `in` lists bounded for Postgres parameter limits. */
export const TIMESLOT_ID_IN_CHUNK_SIZE = 1000

export function chunkIds<T>(ids: T[], size: number): T[][] {
  if (ids.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size))
  }
  return chunks
}

/** All timeslot IDs whose calendar date is in [dateFrom, dateTo], optionally scoped to tenant. */
export async function resolveTimeslotIdsForAnalytics(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<number[]> {
  if (params.preResolvedTimeslotIds !== undefined) {
    return params.preResolvedTimeslotIds
  }

  const { dateFrom, dateTo, tenantId } = params
  const ids: number[] = []
  let page = 1
  for (;;) {
    const andClause: Where[] = [
      {
        date: {
          greater_than_equal: dateFrom,
          less_than_equal: dateTo,
        },
      },
    ]
    if (tenantId != null) {
      andClause.push({ tenant: { equals: tenantId } })
    }
    const res = await payload.find({
      collection: 'timeslots',
      where: { and: andClause },
      limit: TIMESLOT_PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of res.docs) {
      ids.push((d as { id: number }).id)
    }
    if (res.docs.length < TIMESLOT_PAGE_SIZE || page >= (res.totalPages ?? 1)) break
    page += 1
  }
  return ids
}

export function buildConfirmedBookingsWhereForTimeslots(
  timeslotIds: number[],
  tenantId?: number | null,
): Where {
  const andClause: Where[] = [
    { status: { equals: 'confirmed' } },
    { timeslot: { in: timeslotIds } },
  ]
  if (tenantId != null) {
    andClause.push({ tenant: { equals: tenantId } })
  }
  return { and: andClause }
}

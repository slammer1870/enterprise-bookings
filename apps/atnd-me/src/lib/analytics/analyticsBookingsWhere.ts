/**
 * Shared helpers for analytics: confirmed bookings whose timeslot (lesson) falls in the date range.
 * Date params are calendar YYYY-MM-DD and match timeslots.date, not booking createdAt.
 *
 * We resolve timeslot IDs first and filter bookings with `timeslot: { in: ids }` because
 * nested paths like `timeslot.date` on the bookings collection are not reliably supported
 * by the Postgres adapter (they can throw or mis-query at runtime).
 *
 * Timeslot `date` is a localized field; querying it in `where` can fail on Postgres in production.
 * We query a padded `startTime` window (not localized) and keep slots whose calendar `date`
 * falls in [dateFrom, dateTo] (string compare on YYYY-MM-DD).
 */
import type { Payload } from 'payload'
import type { Where } from 'payload'
import type { AnalyticsQueryParams } from './types'

const TIMESLOT_PAGE_SIZE = 1000
/** Keep `in` lists bounded for Postgres parameter limits. */
export const TIMESLOT_ID_IN_CHUNK_SIZE = 1000

/** Shift a calendar YYYY-MM-DD by whole UTC days. */
function padIsoDateYmd(ymd: string, deltaDays: number): string {
  const parts = ymd.split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return ymd
  }
  const y = parts[0]!
  const m = parts[1]!
  const d = parts[2]!
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/** Normalize timeslot.date from a document (string, Date, localized map, or Lexical-like value). */
export function normalizeTimeslotCalendarYmd(raw: unknown, depth = 0): string | null {
  if (depth > 6) return null
  if (typeof raw === 'string') return raw.slice(0, 10)
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    if (typeof v === 'string') return v.slice(0, 10)
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return normalizeTimeslotCalendarYmd(v, depth + 1)
  }
  // Localized shape: { en: "2026-04-10T00:00:00.000Z", ... } from API/DB
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const v of Object.values(raw)) {
      const ymd = normalizeTimeslotCalendarYmd(v, depth + 1)
      if (ymd) return ymd
    }
  }
  return null
}

function calendarYmdInRange(ymd: string | null, from: string, to: string): boolean {
  if (!ymd) return false
  return ymd >= from && ymd <= to
}

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

  const paddedFrom = padIsoDateYmd(dateFrom, -1)
  const paddedTo = padIsoDateYmd(dateTo, 1)

  let page = 1
  for (;;) {
    const andClause: Where[] = [
      {
        startTime: {
          greater_than_equal: `${paddedFrom}T00:00:00.000Z`,
          less_than_equal: `${paddedTo}T23:59:59.999Z`,
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
      select: { id: true, date: true },
      overrideAccess: true,
    })
    for (const d of res.docs) {
      const cal = normalizeTimeslotCalendarYmd((d as { date?: unknown }).date)
      if (calendarYmdInRange(cal, dateFrom, dateTo)) {
        ids.push((d as { id: number }).id)
      }
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

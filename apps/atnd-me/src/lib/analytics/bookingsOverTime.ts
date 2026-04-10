/**
 * Bookings over time (daily or weekly buckets) for trend chart.
 * Buckets by timeslot (lesson) date, not booking creation time.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, BookingsOverTimeRow } from './types'
import {
  buildConfirmedBookingsWhereForTimeslots,
  chunkIds,
  resolveTimeslotIdsForAnalytics,
  TIMESLOT_ID_IN_CHUNK_SIZE,
} from './analyticsBookingsWhere'

const MAX_BOOKINGS_PER_CHUNK = 50_000

/** Normalize timeslot.date from populated relationship (string, Date, or localized value). */
function timeslotDateToYmd(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.slice(0, 10)
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    if (typeof v === 'string') return v.slice(0, 10)
    if (v instanceof Date) return v.toISOString().slice(0, 10)
  }
  return null
}

function toDateKey(iso: string, granularity: 'day' | 'week'): string {
  const d = new Date(iso)
  if (granularity === 'week') {
    const start = new Date(d)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    return start.toISOString().slice(0, 10)
  }
  return iso.slice(0, 10)
}

/** Every calendar YYYY-MM-DD from dateFrom through dateTo (inclusive), UTC. */
function eachCalendarDayYmdInclusive(dateFrom: string, dateTo: string): string[] {
  const partsFrom = dateFrom.split('-').map((x) => parseInt(x, 10))
  const partsTo = dateTo.split('-').map((x) => parseInt(x, 10))
  if (partsFrom.length !== 3 || partsTo.length !== 3 || partsFrom.some(Number.isNaN) || partsTo.some(Number.isNaN)) {
    return []
  }
  const out: string[] = []
  let y = partsFrom[0]!
  let m = partsFrom[1]!
  let d = partsFrom[2]!
  const endUtc = Date.UTC(partsTo[0]!, partsTo[1]! - 1, partsTo[2]!)
  for (;;) {
    const cur = Date.UTC(y, m - 1, d)
    if (cur > endUtc) break
    out.push(new Date(cur).toISOString().slice(0, 10))
    const next = new Date(cur)
    next.setUTCDate(next.getUTCDate() + 1)
    y = next.getUTCFullYear()
    m = next.getUTCMonth() + 1
    d = next.getUTCDate()
  }
  return out
}

/** Distinct week bucket keys (same as toDateKey(..., 'week')) for each day in range. */
function eachWeekBucketKeyInRange(dateFrom: string, dateTo: string): string[] {
  const keys = new Set<string>()
  for (const ymd of eachCalendarDayYmdInclusive(dateFrom, dateTo)) {
    keys.add(toDateKey(`${ymd}T12:00:00.000Z`, 'week'))
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b))
}

function densifyBookingsOverTime(
  bucket: Map<string, number>,
  params: { dateFrom: string; dateTo: string; granularity: 'day' | 'week' },
): BookingsOverTimeRow[] {
  const { dateFrom, dateTo, granularity } = params
  const keys =
    granularity === 'week'
      ? eachWeekBucketKeyInRange(dateFrom, dateTo)
      : eachCalendarDayYmdInclusive(dateFrom, dateTo)
  return keys.map((date) => ({ date, count: bucket.get(date) ?? 0 }))
}

export async function getBookingsOverTime(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<BookingsOverTimeRow[]> {
  const timeslotIds = await resolveTimeslotIdsForAnalytics(payload, params)
  const granularity = params.granularity ?? 'day'

  const bucket = new Map<string, number>()

  if (timeslotIds.length === 0) {
    return []
  }

  for (const idChunk of chunkIds(timeslotIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
    const where = buildConfirmedBookingsWhereForTimeslots(idChunk, params.tenantId)

    const result = await payload.find({
      collection: 'bookings',
      where,
      limit: MAX_BOOKINGS_PER_CHUNK,
      depth: 1,
      select: { timeslot: true },
      overrideAccess: true,
    })

    for (const doc of result.docs) {
      const ts = (doc as { timeslot?: number | { date?: unknown } }).timeslot
      const rawDate = typeof ts === 'object' && ts !== null ? ts.date : undefined
      const ymd = timeslotDateToYmd(rawDate)
      if (!ymd) continue
      const key = toDateKey(`${ymd}T12:00:00.000Z`, granularity)
      bucket.set(key, (bucket.get(key) ?? 0) + 1)
    }
  }

  return densifyBookingsOverTime(bucket, {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    granularity,
  })
}

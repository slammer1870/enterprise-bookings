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

  const sorted = Array.from(bucket.entries()).sort(([a], [b]) => a.localeCompare(b))
  return sorted.map(([date, count]) => ({ date, count }))
}

/**
 * Build dense day/week series for analytics charts (shared by dashboard bundle and tests).
 */
import type { BookingsOverTimeRow } from './types'

export function toDateKey(iso: string, granularity: 'day' | 'week'): string {
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
export function eachCalendarDayYmdInclusive(dateFrom: string, dateTo: string): string[] {
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
export function eachWeekBucketKeyInRange(dateFrom: string, dateTo: string): string[] {
  const keys = new Set<string>()
  for (const ymd of eachCalendarDayYmdInclusive(dateFrom, dateTo)) {
    keys.add(toDateKey(`${ymd}T12:00:00.000Z`, 'week'))
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b))
}

export function densifyBookingsOverTime(
  bucket: Map<string, number>,
  params: { dateFrom: string; dateTo: string; granularity: 'day' | 'week' },
): BookingsOverTimeRow[] {
  const { dateFrom, dateTo, granularity } = params
  const keys =
    granularity === 'week' ? eachWeekBucketKeyInRange(dateFrom, dateTo) : eachCalendarDayYmdInclusive(dateFrom, dateTo)
  return keys.map((date) => ({ date, count: bucket.get(date) ?? 0 }))
}

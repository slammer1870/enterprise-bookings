/**
 * Mirrors analytics timeslot resolution for e2e assertions.
 * Keep aligned with src/lib/analytics/analyticsBookingsWhere.ts (no src/ imports here — Playwright loader).
 */
import { TZDate } from '@date-fns/tz'
import type { Payload } from 'payload'
import type { Where } from 'payload'

const TIMESLOT_PAGE_SIZE = 500
const TIMESLOT_ID_IN_CHUNK_SIZE = 1000
const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** atnd-me payload.config defaultTimezone — fallback for e2e when tenant has no timeZone. */
const DEFAULT_IANA = 'Europe/Dublin'

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

function ymdFromInstantInIana(instant: Date, iana: string): string {
  const tz = (iana && iana.trim()) || 'UTC'
  try {
    const z = new TZDate(instant, tz)
    const y = z.getFullYear()
    const m = String(z.getMonth() + 1).padStart(2, '0')
    const d = String(z.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return instant.toISOString().slice(0, 10)
  }
}

export function normalizeTimeslotCalendarYmd(raw: unknown, iana: string, depth = 0): string | null {
  if (depth > 6) return null
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (YMD_ONLY.test(t)) return t
    const inst = new Date(t)
    if (!Number.isNaN(inst.getTime())) return ymdFromInstantInIana(inst, iana)
    return t.slice(0, 10)
  }
  if (raw instanceof Date) return ymdFromInstantInIana(raw, iana)
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    if (typeof v === 'string' && YMD_ONLY.test(v.trim())) return v.trim()
    if (typeof v === 'string') {
      const inst = new Date(v)
      if (!Number.isNaN(inst.getTime())) return ymdFromInstantInIana(inst, iana)
    }
    if (v instanceof Date) return ymdFromInstantInIana(v, iana)
    return normalizeTimeslotCalendarYmd(v, iana, depth + 1)
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const v of Object.values(raw)) {
      const ymd = normalizeTimeslotCalendarYmd(v, iana, depth + 1)
      if (ymd) return ymd
    }
  }
  return null
}

function calendarYmdInRange(ymd: string | null, from: string, to: string): boolean {
  if (!ymd) return false
  return ymd >= from && ymd <= to
}

function chunkIds<T>(ids: T[], size: number): T[][] {
  if (ids.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size))
  }
  return chunks
}

export type AnalyticsRangeParams = {
  dateFrom: string
  dateTo: string
  tenantId: number
}

export async function resolveTimeslotIdsForAnalyticsE2E(
  payload: Payload,
  params: AnalyticsRangeParams,
): Promise<number[]> {
  const { dateFrom, dateTo, tenantId } = params
  const tdoc = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    select: { timeZone: true },
    overrideAccess: true,
  })
  const tz =
    tdoc && typeof (tdoc as { timeZone?: string }).timeZone === 'string'
      ? (tdoc as { timeZone: string }).timeZone.trim()
      : ''
  const iana = tz || DEFAULT_IANA
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
      { tenant: { equals: tenantId } },
    ]
    const res = await payload.find({
      collection: 'timeslots',
      where: { and: andClause },
      limit: TIMESLOT_PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    })
    for (const d of res.docs) {
      const cal = normalizeTimeslotCalendarYmd((d as { date?: unknown }).date, iana)
      if (calendarYmdInRange(cal, dateFrom, dateTo)) {
        ids.push((d as { id: number }).id)
      }
    }
    if (res.docs.length < TIMESLOT_PAGE_SIZE || page >= (res.totalPages ?? 1)) break
    page += 1
  }
  return ids
}

export async function getCalendarDatesWithTimeslotsInRangeE2E(
  payload: Payload,
  params: AnalyticsRangeParams,
): Promise<Set<string>> {
  const { tenantId } = params
  const tdoc = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    select: { timeZone: true },
    overrideAccess: true,
  })
  const tz =
    tdoc && typeof (tdoc as { timeZone?: string }).timeZone === 'string'
      ? (tdoc as { timeZone: string }).timeZone.trim()
      : ''
  const iana = tz || DEFAULT_IANA
  const ids = await resolveTimeslotIdsForAnalyticsE2E(payload, params)
  const dates = new Set<string>()
  for (const id of ids) {
    const ts = await payload.findByID({
      collection: 'timeslots',
      id,
      depth: 0,
      overrideAccess: true,
    })
    const ymd = normalizeTimeslotCalendarYmd((ts as { date?: unknown } | null)?.date, iana)
    if (ymd) dates.add(ymd)
  }
  return dates
}

function buildConfirmedBookingsWhereForTimeslots(timeslotIds: number[], tenantId: number): Where {
  return {
    and: [
      { status: { equals: 'confirmed' } },
      { timeslot: { in: timeslotIds } },
      { tenant: { equals: tenantId } },
    ],
  }
}

export async function countConfirmedBookingsForResolvedTimeslotsE2E(
  payload: Payload,
  params: AnalyticsRangeParams,
): Promise<number> {
  const ids = await resolveTimeslotIdsForAnalyticsE2E(payload, params)
  let n = 0
  for (const chunk of chunkIds(ids, TIMESLOT_ID_IN_CHUNK_SIZE)) {
    const res = await payload.find({
      collection: 'bookings',
      where: buildConfirmedBookingsWhereForTimeslots(chunk, params.tenantId),
      limit: 50_000,
      depth: 0,
      overrideAccess: true,
    })
    n += res.docs.length
    if (typeof res.totalDocs === 'number' && res.totalDocs > res.docs.length) {
      throw new Error('countConfirmedBookingsForResolvedTimeslotsE2E: result truncated')
    }
  }
  return n
}

export { chunkIds, TIMESLOT_ID_IN_CHUNK_SIZE, buildConfirmedBookingsWhereForTimeslots }

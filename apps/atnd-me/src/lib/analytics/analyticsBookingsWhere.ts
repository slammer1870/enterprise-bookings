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
 *
 * Calendar Y-M-D is derived in the tenant (or app default) IANA zone so it matches the studio
 * date — using UTC from `toISOString()` on instants is wrong for e.g. Europe/Dublin and shifts a day.
 */
import { TZDate } from '@date-fns/tz'
import type { Payload } from 'payload'
import type { Where } from 'payload'
import type { AnalyticsQueryParams } from './types'

const TIMESLOT_PAGE_SIZE = 1000
/** Keep `in` lists bounded for Postgres parameter limits. */
export const TIMESLOT_ID_IN_CHUNK_SIZE = 1000

const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function getDefaultTimeZoneForAnalytics(payload: Payload): string {
  const t = payload.config?.admin?.timezones?.defaultTimezone
  return typeof t === 'string' && t.trim() ? t.trim() : 'UTC'
}

function ymdFromInstantInIana(instant: Date, iana: string | null | undefined): string {
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

/**
 * Timeslot `date` from a document: strings, Date, localized map, or Lexical-like value.
 * For datetimes, calendar day is taken in `iana` (tenant or app default), not UTC.
 * Pure `YYYY-MM-DD` strings are returned as-is.
 */
export function normalizeTimeslotCalendarYmd(
  raw: unknown,
  iana: string | null | undefined,
  depth = 0,
): string | null {
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

export function timeslotDocumentTenantId(doc: { tenant?: unknown }): number | null {
  const t = doc.tenant
  if (t == null) return null
  if (typeof t === 'object' && t !== null && 'id' in t) {
    const id = (t as { id: unknown }).id
    return typeof id === 'number' && Number.isFinite(id) ? id : null
  }
  if (typeof t === 'number' && Number.isFinite(t)) return t
  return null
}

export async function loadTenantIanaById(
  payload: Payload,
  tenantIds: number[],
): Promise<Map<number, string | undefined>> {
  const map = new Map<number, string | undefined>()
  const unique = [...new Set(tenantIds)] as number[]
  if (unique.length === 0) return map
  const res = await payload.find({
    collection: 'tenants',
    where: { id: { in: unique } },
    limit: unique.length,
    depth: 0,
    select: { id: true, timeZone: true },
    overrideAccess: true,
  })
  for (const t of res.docs) {
    const row = t as { id: number; timeZone?: string | null }
    const z = row.timeZone && typeof row.timeZone === 'string' ? row.timeZone.trim() : ''
    map.set(row.id, z || undefined)
  }
  for (const id of unique) {
    if (!map.has(id)) map.set(id, undefined)
  }
  return map
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

  const defaultTz = getDefaultTimeZoneForAnalytics(payload)
  const paddedFrom = padIsoDateYmd(dateFrom, -1)
  const paddedTo = padIsoDateYmd(dateTo, 1)

  let scopedIana: string | null = null
  if (tenantId != null) {
    const tdoc = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      select: { timeZone: true },
      overrideAccess: true,
    })
    const tz =
      tdoc && typeof (tdoc as { timeZone?: unknown }).timeZone === 'string'
        ? (tdoc as { timeZone: string }).timeZone.trim()
        : ''
    scopedIana = (tz || defaultTz) as string
  }

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
      select: { id: true, date: true, tenant: true },
      overrideAccess: true,
    })

    let zoneByTenant: Map<number, string | undefined> | null = null
    if (scopedIana == null) {
      const tids: number[] = []
      for (const d of res.docs) {
        const tid = timeslotDocumentTenantId(d as { tenant?: unknown })
        if (tid != null) tids.push(tid)
      }
      zoneByTenant = await loadTenantIanaById(payload, tids)
    }

    for (const d of res.docs) {
      const doc = d as { id: number; date?: unknown; tenant?: unknown }
      let iana: string
      if (scopedIana != null) {
        iana = scopedIana
      } else {
        const tid = timeslotDocumentTenantId(doc)
        iana = (tid != null ? zoneByTenant!.get(tid) : undefined) ?? defaultTz
      }
      const cal = normalizeTimeslotCalendarYmd(doc.date, iana)
      if (calendarYmdInRange(cal, dateFrom, dateTo)) {
        ids.push(doc.id)
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

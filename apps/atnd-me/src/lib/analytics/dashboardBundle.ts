/**
 * Per timeslot chunk: parallel timeslot date map + booking count + booking find (depth 0).
 * Calendar bucketing uses one timeslot `find` per chunk instead of depth:1 joins on every row.
 */
import type { Payload } from 'payload'
import type {
  AnalyticsQueryParams,
  BookingsOverTimeRow,
  SummaryMetrics,
  TopCustomerRow,
} from './types'
import {
  buildConfirmedBookingsWhereForTimeslots,
  chunkIds,
  getDefaultTimeZoneForAnalytics,
  loadTenantIanaById,
  normalizeTimeslotCalendarYmd,
  resolveTimeslotIdsForAnalytics,
  timeslotDocumentTenantId,
  TIMESLOT_ID_IN_CHUNK_SIZE,
} from './analyticsBookingsWhere'
import { densifyBookingsOverTime, toDateKey } from './bookingsOverTimeDense'

type TimeslotYmdIanaMode =
  | { kind: 'scoped'; iana: string }
  | { kind: 'per-tenant'; defaultIana: string }

const MAX_BOOKINGS_PER_CHUNK = 50_000
const DEFAULT_TOP_LIMIT = 10

export type AnalyticsDashboardBundleOptions = {
  /** When false, skips per-user booking counts and user lookup (e.g. previous-period comparison). */
  includeTopCustomers?: boolean
}

function bookingUserId(doc: { user?: number | { id: number } }): number | null {
  const u = doc.user
  const uid = typeof u === 'object' && u !== null ? u.id : u
  return typeof uid === 'number' ? uid : null
}

/** One query per timeslot chunk: avoids depth:1 on every booking row for calendar bucketing. */
async function loadTimeslotCalendarYmdById(
  payload: Payload,
  timeslotIds: number[],
  ianaMode: TimeslotYmdIanaMode,
): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>()
  if (timeslotIds.length === 0) return map

  const res = await payload.find({
    collection: 'timeslots',
    where: { id: { in: timeslotIds } },
    limit: timeslotIds.length,
    depth: 0,
    select: { id: true, date: true, tenant: true },
    overrideAccess: true,
  })

  if (ianaMode.kind === 'scoped') {
    for (const d of res.docs) {
      const row = d as { id: number; date?: unknown }
      map.set(row.id, normalizeTimeslotCalendarYmd(row.date, ianaMode.iana))
    }
    return map
  }

  const tids: number[] = []
  for (const d of res.docs) {
    const tid = timeslotDocumentTenantId(d as { tenant?: unknown })
    if (tid != null) tids.push(tid)
  }
  const byTenant = await loadTenantIanaById(payload, tids)
  const defaultIana = ianaMode.defaultIana
  for (const d of res.docs) {
    const row = d as { id: number; date?: unknown; tenant?: unknown }
    const tid = timeslotDocumentTenantId(row)
    const iana = (tid != null ? byTenant.get(tid) : undefined) ?? defaultIana
    map.set(row.id, normalizeTimeslotCalendarYmd(row.date, iana))
  }
  return map
}

async function resolveTopCustomerRows(
  payload: Payload,
  byUser: Map<number, number>,
  limit: number,
): Promise<TopCustomerRow[]> {
  const rows = Array.from(byUser.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  if (rows.length === 0) return rows

  const userIds = rows.map((r) => r.userId)
  const users = await payload.find({
    collection: 'users',
    where: { id: { in: userIds } },
    depth: 0,
    limit: userIds.length,
    select: { id: true, name: true, email: true },
    overrideAccess: true,
  })

  const userMap = new Map<number, string>()
  for (const u of users.docs) {
    const user = u as { id: number; name?: string | null; email?: string | null }
    const label = user.name?.trim() || user.email || `User ${user.id}`
    userMap.set(user.id, label)
  }

  return rows.map((r) => ({
    ...r,
    userName: userMap.get(r.userId),
  }))
}

export async function getAnalyticsDashboardBundle(
  payload: Payload,
  params: AnalyticsQueryParams,
  options?: AnalyticsDashboardBundleOptions,
): Promise<{
  summary: SummaryMetrics
  bookingsOverTime: BookingsOverTimeRow[]
  topCustomers: TopCustomerRow[]
}> {
  const includeTopCustomers = options?.includeTopCustomers !== false
  const granularity = params.granularity ?? 'day'
  const topLimit = params.limitTopCustomers ?? DEFAULT_TOP_LIMIT

  const timeslotIds = await resolveTimeslotIdsForAnalytics(payload, params)

  if (timeslotIds.length === 0) {
    return {
      summary: { totalBookings: 0, uniqueCustomers: 0, grossVolumeCents: 0 },
      bookingsOverTime: densifyBookingsOverTime(new Map(), {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        granularity,
      }),
      topCustomers: [],
    }
  }

  const defaultTz = getDefaultTimeZoneForAnalytics(payload)
  let ymdIanaMode: TimeslotYmdIanaMode
  if (params.tenantId != null) {
    const tdoc = await payload.findByID({
      collection: 'tenants',
      id: params.tenantId,
      depth: 0,
      select: { timeZone: true },
      overrideAccess: true,
    })
    const tz =
      tdoc && typeof (tdoc as { timeZone?: unknown }).timeZone === 'string'
        ? (tdoc as { timeZone: string }).timeZone.trim()
        : ''
    ymdIanaMode = { kind: 'scoped', iana: tz || defaultTz }
  } else {
    ymdIanaMode = { kind: 'per-tenant', defaultIana: defaultTz }
  }

  let totalBookings = 0
  const uniqueUserIds = new Set<number>()
  const timeBucket = new Map<string, number>()
  const byUser = new Map<number, number>()

  for (const idChunk of chunkIds(timeslotIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
    const where = buildConfirmedBookingsWhereForTimeslots(idChunk, params.tenantId)
    const [timeslotYmdById, countResult, docsResult] = await Promise.all([
      loadTimeslotCalendarYmdById(payload, idChunk, ymdIanaMode),
      payload.count({
        collection: 'bookings',
        where,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'bookings',
        where,
        limit: MAX_BOOKINGS_PER_CHUNK,
        depth: 0,
        select: { user: true, timeslot: true },
        overrideAccess: true,
      }),
    ])

    totalBookings += countResult.totalDocs ?? 0

    for (const doc of docsResult.docs) {
      const d = doc as { user?: number | { id: number }; timeslot?: number | { id?: number } }

      const uid = bookingUserId(d)
      if (uid !== null) {
        uniqueUserIds.add(uid)
        if (includeTopCustomers) {
          byUser.set(uid, (byUser.get(uid) ?? 0) + 1)
        }
      }

      const ts = d.timeslot
      const tsId = typeof ts === 'object' && ts !== null && 'id' in ts ? (ts as { id: number }).id : ts
      const ymd =
        typeof tsId === 'number' ? timeslotYmdById.get(tsId) ?? null : null
      if (ymd) {
        const key = toDateKey(`${ymd}T12:00:00.000Z`, granularity)
        timeBucket.set(key, (timeBucket.get(key) ?? 0) + 1)
      }
    }
  }

  const bookingsOverTime = densifyBookingsOverTime(timeBucket, {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    granularity,
  })

  const topCustomers = includeTopCustomers
    ? await resolveTopCustomerRows(payload, byUser, topLimit)
    : []

  return {
    summary: {
      totalBookings,
      uniqueCustomers: uniqueUserIds.size,
      grossVolumeCents: 0,
    },
    bookingsOverTime,
    topCustomers,
  }
}

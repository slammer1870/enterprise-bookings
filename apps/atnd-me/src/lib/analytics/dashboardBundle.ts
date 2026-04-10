/**
 * Single pass over confirmed bookings per timeslot chunk: count + one populated find
 * feeds summary, bookings-over-time, and top customers (avoids 3–4x redundant DB work).
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
  normalizeTimeslotCalendarYmd,
  resolveTimeslotIdsForAnalytics,
  TIMESLOT_ID_IN_CHUNK_SIZE,
} from './analyticsBookingsWhere'
import { densifyBookingsOverTime, toDateKey } from './bookingsOverTimeDense'

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

  let totalBookings = 0
  const uniqueUserIds = new Set<number>()
  const timeBucket = new Map<string, number>()
  const byUser = new Map<number, number>()

  for (const idChunk of chunkIds(timeslotIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
    const where = buildConfirmedBookingsWhereForTimeslots(idChunk, params.tenantId)

    const [countResult, docsResult] = await Promise.all([
      payload.count({
        collection: 'bookings',
        where,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'bookings',
        where,
        limit: MAX_BOOKINGS_PER_CHUNK,
        depth: 1,
        select: { user: true, timeslot: true },
        overrideAccess: true,
      }),
    ])

    totalBookings += countResult.totalDocs ?? 0

    for (const doc of docsResult.docs) {
      const d = doc as { user?: number | { id: number }; timeslot?: number | { date?: unknown } }

      const uid = bookingUserId(d)
      if (uid !== null) {
        uniqueUserIds.add(uid)
        if (includeTopCustomers) {
          byUser.set(uid, (byUser.get(uid) ?? 0) + 1)
        }
      }

      const ts = d.timeslot
      const rawDate = typeof ts === 'object' && ts !== null ? ts.date : undefined
      const ymd = normalizeTimeslotCalendarYmd(rawDate)
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

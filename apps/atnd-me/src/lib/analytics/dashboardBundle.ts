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
  LikelyChurnCustomerRow,
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
import { subscriptionBelongsToTenantContext } from '@/blocks/DhLiveMembership/subscription-tenant-context'

type TimeslotYmdIanaMode =
  | { kind: 'scoped'; iana: string }
  | { kind: 'per-tenant'; defaultIana: string }

const MAX_BOOKINGS_PER_CHUNK = 50_000
const DEFAULT_TOP_LIMIT = 10
const DEFAULT_LIKELY_CHURN_LIMIT = 10
const CHURN_INACTIVITY_DAYS = 7
const CHURN_TREND_WINDOW_DAYS = 30

export type AnalyticsDashboardBundleOptions = {
  /** When false, skips summary computation (total bookings + unique customers). */
  includeSummary?: boolean
  /** When false, skips bookingsOverTime computation (trend chart). */
  includeBookingsOverTime?: boolean
  /** When false, skips per-user booking counts and user lookup (e.g. previous-period comparison). */
  includeTopCustomers?: boolean
  /** When false, skips churn scoring + ranking. */
  includeLikelyChurnCustomers?: boolean
}

function bookingUserId(doc: { user?: number | { id: number } }): number | null {
  const u = doc.user
  const uid = typeof u === 'object' && u !== null ? u.id : u
  return typeof uid === 'number' ? uid : null
}

function shiftYmdUtc(date: string, deltaDays: number): string {
  const parts = date.split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return date
  const y = parts[0]!
  const m = parts[1]!
  const d = parts[2]!
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** One query per timeslot chunk: avoids depth:1 on every booking row for calendar bucketing. */
async function loadTimeslotCalendarInfoById(
  payload: Payload,
  timeslotIds: number[],
  ianaMode: TimeslotYmdIanaMode,
): Promise<{
  ymdById: Map<number, string | null>
  tenantById: Map<number, number | null>
}> {
  const ymdById = new Map<number, string | null>()
  const tenantById = new Map<number, number | null>()
  if (timeslotIds.length === 0) return { ymdById, tenantById }

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
      ymdById.set(row.id, normalizeTimeslotCalendarYmd(row.date, ianaMode.iana))
      tenantById.set(row.id, timeslotDocumentTenantId(row as any))
    }
    return { ymdById, tenantById }
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
    ymdById.set(row.id, normalizeTimeslotCalendarYmd(row.date, iana))
    tenantById.set(row.id, tid)
  }
  return { ymdById, tenantById }
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
  likelyChurnCustomers: LikelyChurnCustomerRow[]
  likelyChurnCustomersTotal: number
}> {
  const includeSummary = options?.includeSummary !== false
  const includeBookingsOverTime = options?.includeBookingsOverTime !== false
  const includeTopCustomers = options?.includeTopCustomers !== false
  const includeLikelyChurnCustomers = options?.includeLikelyChurnCustomers !== false

  const granularity = params.granularity ?? 'day'
  const topLimit = params.limitTopCustomers ?? DEFAULT_TOP_LIMIT
  const likelyLimit = params.limitLikelyChurnCustomers ?? DEFAULT_LIKELY_CHURN_LIMIT
  const likelyOffset = params.offsetLikelyChurnCustomers ?? 0

  const timeslotIds = await resolveTimeslotIdsForAnalytics(payload, params)

  if (timeslotIds.length === 0) {
    return {
      summary: { totalBookings: 0, uniqueCustomers: 0, grossVolumeCents: 0 },
      bookingsOverTime: includeBookingsOverTime
        ? densifyBookingsOverTime(new Map(), {
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            granularity,
          })
        : [],
      topCustomers: includeTopCustomers ? [] : [],
      likelyChurnCustomers: [],
      likelyChurnCustomersTotal: 0,
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

  type ChurnAgg = {
    /** Confirmed bookings in the last 7 days (ending at params.dateTo, inclusive). */
    recentBookings: number
    /** Confirmed bookings in the "this week" window starting on Wednesday (Thu+ only). */
    recentBookingsThisWeek: number
    priorBookings: number
    /** Confirmed bookings per day in the churn trend window (length = CHURN_TREND_WINDOW_DAYS). */
    dayCounts: number[]
  }

  let totalBookings = 0
  const uniqueUserIds = includeSummary ? new Set<number>() : new Set<number>()
  const timeBucket = includeBookingsOverTime ? new Map<string, number>() : new Map<string, number>()
  const byUser = includeTopCustomers ? new Map<number, number>() : new Map<number, number>()
  const churnAggByUser = includeLikelyChurnCustomers ? new Map<number, ChurnAgg>() : new Map<number, ChurnAgg>()
  const churnAggTenantIdsByUser = includeLikelyChurnCustomers ? new Map<number, Set<number>>() : new Map<number, Set<number>>()

  // Churn heuristic windows:
  // - eligibility (recency):
  //   * always: include users with no confirmed booking in the previous 7 days
  //   * after Wednesday: also include users with no confirmed booking in the previous 4 days
  // - trend decline: last ~30 days ending at params.dateTo (inclusive)
  const dayOfWeek = new Date(`${params.dateTo}T00:00:00.000Z`).getUTCDay() // Sun=0 ... Sat=6
  const inactivityFromYmd7 = shiftYmdUtc(params.dateTo, -(CHURN_INACTIVITY_DAYS - 1))
  const pastWednesday = dayOfWeek > 3 // Thu=4 ...
  const cutoffWednesdayYmd = pastWednesday ? shiftYmdUtc(params.dateTo, -(dayOfWeek - 3)) : null
  const churnFromYmd = shiftYmdUtc(params.dateTo, -(CHURN_TREND_WINDOW_DAYS - 1))

  const needTimeslotYmd = includeBookingsOverTime || includeLikelyChurnCustomers

  for (const idChunk of chunkIds(timeslotIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
    const where = buildConfirmedBookingsWhereForTimeslots(idChunk, params.tenantId)
    const timeslotYmdPromise = needTimeslotYmd
      ? loadTimeslotCalendarInfoById(payload, idChunk, ymdIanaMode)
      : Promise.resolve({ ymdById: new Map<number, string | null>(), tenantById: new Map<number, number | null>() })

    const countPromise = includeSummary
      ? payload.count({
          collection: 'bookings',
          where,
          overrideAccess: true,
        })
      : Promise.resolve({ totalDocs: 0 })

    const docsPromise = payload.find({
      collection: 'bookings',
      where,
      limit: MAX_BOOKINGS_PER_CHUNK,
      depth: 0,
      select: { user: true, timeslot: true },
      overrideAccess: true,
    })

    const [timeslotInfo, countResult, docsResult] = await Promise.all([
      timeslotYmdPromise,
      countPromise,
      docsPromise,
    ])

    if (includeSummary) totalBookings += countResult.totalDocs ?? 0

    for (const doc of docsResult.docs) {
      const d = doc as { user?: number | { id: number }; timeslot?: number | { id?: number } }

      const uid = bookingUserId(d)
      if (uid !== null) {
        if (includeSummary) uniqueUserIds.add(uid)
        if (includeTopCustomers) byUser.set(uid, (byUser.get(uid) ?? 0) + 1)
      }

      if (!needTimeslotYmd) continue

      const ts = d.timeslot
      const tsId = typeof ts === 'object' && ts !== null && 'id' in ts ? (ts as { id: number }).id : ts
      const ymd = typeof tsId === 'number' ? timeslotInfo.ymdById.get(tsId) ?? null : null
      if (!ymd) continue

      if (includeBookingsOverTime) {
        const key = toDateKey(`${ymd}T12:00:00.000Z`, granularity)
        timeBucket.set(key, (timeBucket.get(key) ?? 0) + 1)
      }

      if (includeLikelyChurnCustomers) {
        // Only score within the churn trend window (last ~30 days).
        if (ymd < churnFromYmd || ymd > params.dateTo) continue
        if (uid === null) continue

        let agg = churnAggByUser.get(uid)
        if (!agg) {
          agg = {
            recentBookings: 0,
            recentBookingsThisWeek: 0,
            priorBookings: 0,
            dayCounts: Array(CHURN_TREND_WINDOW_DAYS).fill(0),
          }
          churnAggByUser.set(uid, agg)
        }

        // Eligibility recency buckets:
        // - recentBookings = last 7 days
        // - recentBookingsThisWeek = bookings since Wednesday of current week (Thu+ only)
        if (ymd >= inactivityFromYmd7) agg.recentBookings += 1
        else agg.priorBookings += 1

        if (cutoffWednesdayYmd != null && ymd >= cutoffWednesdayYmd) agg.recentBookingsThisWeek += 1

        // Also store daily counts for rolling 7d frequency computations.
        if (includeLikelyChurnCustomers) {
          const ymdToDayNumber = (v: string): number => {
            const [yy, mm, dd] = v.split('-').map((x) => parseInt(x, 10))
            if (yy == null || mm == null || dd == null) return 0
            return Math.floor(Date.UTC(yy, mm - 1, dd) / 86400000)
          }
          const dayOffset = ymdToDayNumber(ymd) - ymdToDayNumber(churnFromYmd)
          if (dayOffset >= 0 && dayOffset < CHURN_TREND_WINDOW_DAYS) {
            agg.dayCounts[dayOffset]! += 1
          }
        }

        const tenantIdForTimeslot = typeof tsId === 'number' ? timeslotInfo.tenantById.get(tsId) : null
        if (tenantIdForTimeslot != null) {
          let tenantSet = churnAggTenantIdsByUser.get(uid)
          if (!tenantSet) {
            tenantSet = new Set<number>()
            churnAggTenantIdsByUser.set(uid, tenantSet)
          }
          tenantSet.add(tenantIdForTimeslot)
        }
      }
    }
  }

  const bookingsOverTime = includeBookingsOverTime
    ? densifyBookingsOverTime(timeBucket, {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        granularity,
      })
    : []

  const topCustomers = includeTopCustomers ? await resolveTopCustomerRows(payload, byUser, topLimit) : []

  // Subscription-filter + score calculation (implemented after we fetch subscriptions
  // to avoid per-user queries).
  let scoredRowsWithUserNames: Array<{
    userId: number
    score: number
    recentBookings: number
    priorBookings: number
  }> = []
  if (includeLikelyChurnCustomers) {
    const churnUserIds = Array.from(churnAggByUser.keys())
    if (churnUserIds.length > 0) {
      const statuses = ['active', 'past_due'] as const
      const pageSize = 500
      let page = 1
      const subscribedUserIds = new Set<number>()

      // Paginate subscriptions to keep payload queries bounded.
      for (;;) {
        const res = await payload.find({
          collection: 'subscriptions',
          where: { and: [{ user: { in: churnUserIds } }, { status: { in: statuses } }] },
          limit: pageSize,
          page,
          depth: 2,
          select: { user: true, plan: true, status: true },
          overrideAccess: true,
        })

        for (const doc of res.docs) {
          const d = doc as unknown as { user?: number | { id: number }; plan?: unknown; status?: string }
          const u = d.user
          const uid = typeof u === 'object' && u !== null && 'id' in u ? (u as { id: number }).id : (typeof u === 'number' ? u : null)
          if (uid == null) continue

          const belongs =
            params.tenantId != null
              ? subscriptionBelongsToTenantContext(doc as any, params.tenantId)
              : (() => {
                  const tenantSet = churnAggTenantIdsByUser.get(uid)
                  if (!tenantSet || tenantSet.size === 0) return true
                  for (const tid of tenantSet) {
                    if (subscriptionBelongsToTenantContext(doc as any, tid)) return true
                  }
                  return false
                })()
          if (belongs) subscribedUserIds.add(uid)
        }

        if (subscribedUserIds.size >= churnUserIds.length) break
        if (page >= (res.totalPages ?? 1)) break
        page += 1
      }

      scoredRowsWithUserNames = Array.from(churnAggByUser.entries())
        .filter(([userId, agg]) => {
          if (!subscribedUserIds.has(userId)) return false
          if (cutoffWednesdayYmd != null) {
            // Thu+: include only when there are no bookings in the current week window.
            return agg.recentBookingsThisWeek === 0
          }
          // Mon-Tue-Wed: include only when there are no bookings in the previous 7 days.
          return agg.recentBookings === 0
        })
        .map(([userId, agg]) => {
          // Rolling 7-day frequency trend:
          // - recentRolling = bookings in the last 7 days
          // - avgEarlyRolling = average bookings in rolling 7-day windows ending before that
          const recentEndIndex = CHURN_TREND_WINDOW_DAYS - 1
          const recentStartIndex = Math.max(0, recentEndIndex - 6)
          const recentRolling = agg.dayCounts
            .slice(recentStartIndex, recentEndIndex + 1)
            .reduce((a, b) => a + b, 0)

          const prefix: number[] = [0]
          for (const c of agg.dayCounts) prefix.push(prefix[prefix.length - 1]! + c)
          const rollingSumForEnd = (endIndex: number): number => prefix[endIndex + 1]! - prefix[endIndex + 1 - 7]!

          const earlyEndMin = 6
          const earlyEndMax = recentEndIndex - 7 // inclusive
          let earlyRollingTotal = 0
          let earlyRollingCount = 0
          for (let end = earlyEndMin; end <= earlyEndMax; end += 1) {
            if (end + 1 - 7 < 0) continue
            earlyRollingTotal += rollingSumForEnd(end)
            earlyRollingCount += 1
          }
          const avgEarlyRolling = earlyRollingCount > 0 ? earlyRollingTotal / earlyRollingCount : 0

          if (avgEarlyRolling <= 0) {
            return { userId, score: 0, recentBookings: agg.recentBookings, priorBookings: agg.priorBookings }
          }

          const declineRatio = (avgEarlyRolling - recentRolling) / (avgEarlyRolling + 1)
          const declineRatioClamped = clamp(declineRatio, 0, 1)
          const inactivityBoost = recentRolling === 0 ? 1 : 0.5
          const score = Math.round(declineRatioClamped * inactivityBoost * 100)

          return { userId, score, recentBookings: agg.recentBookings, priorBookings: agg.priorBookings }
        })

      scoredRowsWithUserNames.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.priorBookings !== a.priorBookings) return b.priorBookings - a.priorBookings
        return a.userId - b.userId
      })
    }
  }

  const likelyChurnCustomersTotal = includeLikelyChurnCustomers ? scoredRowsWithUserNames.length : 0
  const likelyChurnSlice = includeLikelyChurnCustomers
    ? scoredRowsWithUserNames.slice(likelyOffset, likelyOffset + likelyLimit)
    : []

  let likelyChurnCustomers: LikelyChurnCustomerRow[] = []
  if (includeLikelyChurnCustomers && likelyChurnSlice.length > 0) {
    const userIds = likelyChurnSlice.map((r) => r.userId)

        // "Last check-in date" = most recent confirmed booking timeslot date that is
        // <= the eligibility cutoff (to avoid returning future lessons and to ensure
        // the check-in is consistent with the "no booking this week/last 7 days" rule).
    const lastCheckInDateByUserId = new Map<number, string | null>()

    const maxAttempts = 10
    for (const userId of userIds) {
      let found: string | null = null

        for (let page = 1; page <= maxAttempts; page += 1) {
        const res = await payload.find({
          collection: 'bookings',
          where: { and: [{ user: { equals: userId } }, { status: { equals: 'confirmed' } }] },
          depth: 0,
          limit: 1,
          page,
          sort: '-updatedAt',
          select: { timeslot: true },
          overrideAccess: true,
        })

        const doc = res.docs[0] as unknown as { timeslot?: number | { id: number } } | undefined
        const ts = doc?.timeslot
        const tsId =
          typeof ts === 'object' && ts !== null && 'id' in ts ? (ts as { id: number }).id : (ts as number | undefined)
        if (typeof tsId !== 'number' || !Number.isFinite(tsId)) continue

        const info = await loadTimeslotCalendarInfoById(payload, [tsId], ymdIanaMode)
        const ymd = info.ymdById.get(tsId) ?? null
          // Ensure the check-in date shown on the churn table always falls outside
          // the "previous 7 days" window: earliest possible is dateTo - 6 days.
          if (ymd != null && ymd <= inactivityFromYmd7) {
          found = ymd
          break
        }
      }

      lastCheckInDateByUserId.set(userId, found)
    }

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

    likelyChurnCustomers = likelyChurnSlice.map((r) => ({
      userId: r.userId,
      score: r.score,
      recentBookings: r.recentBookings,
      priorBookings: r.priorBookings,
      userName: userMap.get(r.userId),
      lastCheckInDate: lastCheckInDateByUserId.get(r.userId) ?? null,
    }))
  }

  return {
    summary: {
      totalBookings: includeSummary ? totalBookings : 0,
      uniqueCustomers: includeSummary ? uniqueUserIds.size : 0,
      grossVolumeCents: 0,
    },
    bookingsOverTime,
    topCustomers,
    likelyChurnCustomers,
    likelyChurnCustomersTotal,
  }
}

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
const UNLIMITED_MEMBERSHIP_MIN_SESSIONS = 8
const YMD_ONLY_FOR_REVENUE = /^\d{4}-\d{2}-\d{2}$/

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

type RevenueBookingCandidate = {
  bookingId: number
  userId: number | null
}

function relationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' && Number.isFinite(id) ? id : null
  }
  return null
}

function priceToCents(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100)
    : 0
}

function billingPeriodDays(interval: unknown): number {
  if (interval === 'day') return 1
  if (interval === 'week') return 7
  if (interval === 'year') return 364
  return 28
}

/**
 * Estimates the attributable value of confirmed bookings from the product used
 * to create each booking. Product prices are stored in euros while analytics
 * exposes integer cents.
 *
 * Unlimited memberships intentionally use the selected analytics range as the
 * usage window when subscription billing-period history is unavailable. The
 * eight-session floor prevents low-usage members from inflating the estimate.
 */
async function calculateRevenueEstimate(
  payload: Payload,
  candidates: RevenueBookingCandidate[],
  params: AnalyticsQueryParams,
): Promise<number> {
  if (candidates.length === 0) return 0

  const transactionByBookingId = new Map<number, {
    paymentMethod?: string
    dropInId?: unknown
    classPassId?: unknown
    subscriptionId?: unknown
  }>()
  for (const ids of chunkIds(candidates.map((c) => c.bookingId), TIMESLOT_ID_IN_CHUNK_SIZE)) {
    const result = await payload.find({
      collection: 'transactions',
      where: { booking: { in: ids } },
      limit: ids.length,
      depth: 0,
      select: { booking: true, paymentMethod: true, dropInId: true, classPassId: true, subscriptionId: true },
      overrideAccess: true,
    })
    for (const row of result.docs) {
      const doc = row as {
        booking?: unknown
        paymentMethod?: string
        dropInId?: unknown
        classPassId?: unknown
        subscriptionId?: unknown
      }
      const bookingId = relationId(doc.booking)
      if (bookingId != null) transactionByBookingId.set(bookingId, doc)
    }
  }

  const dropInIds = new Set<number>()
  const classPassIds = new Set<number>()
  const subscriptionIds = new Set<number>()
  for (const tx of transactionByBookingId.values()) {
    const dropInId = relationId(tx.dropInId)
    const classPassId = relationId(tx.classPassId)
    const subscriptionId = relationId(tx.subscriptionId)
    if (dropInId != null) dropInIds.add(dropInId)
    if (classPassId != null) classPassIds.add(classPassId)
    if (subscriptionId != null) subscriptionIds.add(subscriptionId)
  }

  const [dropIns, classPasses, subscriptions] = await Promise.all([
    dropInIds.size > 0
      ? payload.find({
          collection: 'drop-ins',
          where: { id: { in: [...dropInIds] } },
          limit: dropInIds.size,
          depth: 0,
          select: { id: true, price: true },
          overrideAccess: true,
        })
      : Promise.resolve({ docs: [] as unknown[] }),
    classPassIds.size > 0
      ? payload.find({
          collection: 'class-passes',
          where: { id: { in: [...classPassIds] } },
          limit: classPassIds.size,
          depth: 0,
          select: { id: true, type: true },
          overrideAccess: true,
        })
      : Promise.resolve({ docs: [] as unknown[] }),
    subscriptionIds.size > 0
      ? payload.find({
          collection: 'subscriptions',
          where: { id: { in: [...subscriptionIds] } },
          limit: subscriptionIds.size,
          depth: 0,
          select: { id: true, user: true, plan: true, startDate: true, endDate: true },
          overrideAccess: true,
        })
      : Promise.resolve({ docs: [] as unknown[] }),
  ])

  const dropInPriceById = new Map<number, number>()
  for (const row of dropIns.docs) {
    const doc = row as { id?: number; price?: unknown }
    if (typeof doc.id === 'number') dropInPriceById.set(doc.id, priceToCents(doc.price))
  }

  const classPassTypeIds = new Set<number>()
  const classPassTypeByPassId = new Map<number, number>()
  for (const row of classPasses.docs) {
    const doc = row as { id?: number; type?: unknown }
    const typeId = relationId(doc.type)
    if (typeof doc.id === 'number' && typeId != null) {
      classPassTypeIds.add(typeId)
      classPassTypeByPassId.set(doc.id, typeId)
    }
  }
  const classPassTypes = classPassTypeIds.size > 0
    ? await payload.find({
        collection: 'class-pass-types',
        where: { id: { in: [...classPassTypeIds] } },
        limit: classPassTypeIds.size,
        depth: 0,
        select: { id: true, quantity: true, priceInformation: true },
        overrideAccess: true,
      })
    : { docs: [] as unknown[] }
  const classPassValueByTypeId = new Map<number, number>()
  for (const row of classPassTypes.docs) {
    const doc = row as {
      id?: number
      quantity?: unknown
      priceInformation?: { price?: unknown }
    }
    if (typeof doc.id !== 'number' || typeof doc.quantity !== 'number' || doc.quantity <= 0) continue
    classPassValueByTypeId.set(doc.id, Math.round(priceToCents(doc.priceInformation?.price) / doc.quantity))
  }

  const planIds = new Set<number>()
  const subscriptionById = new Map<number, {
    userId: number | null
    planId: number | null
    startDate: string | null
    endDate: string | null
  }>()
  for (const row of subscriptions.docs) {
    const doc = row as {
      id?: number
      user?: unknown
      plan?: unknown
      startDate?: unknown
      endDate?: unknown
    }
    if (typeof doc.id === 'number') {
      const planId = relationId(doc.plan)
      subscriptionById.set(doc.id, {
        userId: relationId(doc.user),
        planId,
        startDate: typeof doc.startDate === 'string' ? doc.startDate.slice(0, 10) : null,
        endDate: typeof doc.endDate === 'string' ? doc.endDate.slice(0, 10) : null,
      })
      if (planId != null) planIds.add(planId)
    }
  }
  const plans = planIds.size > 0
    ? await payload.find({
        collection: 'plans',
        where: { id: { in: [...planIds] } },
        limit: planIds.size,
        depth: 0,
        select: { id: true, priceInformation: true, sessionsInformation: true },
        overrideAccess: true,
      })
    : { docs: [] as unknown[] }
  const planById = new Map<number, {
    priceCents: number
    sessions: number | null
  }>()
  for (const row of plans.docs) {
    const doc = row as {
      id?: number
      priceInformation?: { price?: unknown; interval?: unknown; intervalCount?: unknown }
      sessionsInformation?: { sessions?: unknown; interval?: unknown; intervalCount?: unknown }
    }
    if (typeof doc.id !== 'number') continue
    const sessions = doc.sessionsInformation?.sessions
    const sessionIntervalCount =
      typeof doc.sessionsInformation?.intervalCount === 'number' &&
      doc.sessionsInformation.intervalCount > 0
        ? doc.sessionsInformation.intervalCount
        : 1
    const priceIntervalCount =
      typeof doc.priceInformation?.intervalCount === 'number' &&
      doc.priceInformation.intervalCount > 0
        ? doc.priceInformation.intervalCount
        : 1
    const sessionsPerBillingPeriod =
      typeof sessions === 'number' && sessions > 0
        ? (sessions / sessionIntervalCount) *
          (billingPeriodDays(doc.priceInformation?.interval) /
            billingPeriodDays(doc.sessionsInformation?.interval)) *
          priceIntervalCount
        : null
    planById.set(doc.id, {
      priceCents: priceToCents(doc.priceInformation?.price),
      sessions:
        sessionsPerBillingPeriod != null && sessionsPerBillingPeriod > 0
          ? sessionsPerBillingPeriod
          : null,
    })
  }

  const bookingsByUser = new Map<number, number>()
  for (const candidate of candidates) {
    if (candidate.userId != null) {
      bookingsByUser.set(candidate.userId, (bookingsByUser.get(candidate.userId) ?? 0) + 1)
    }
  }

  // Unlimited plans need usage-based allocation. When a subscription has a
  // current billing window, count all of the member's bookings in that window
  // (across locations); older/test records without dates fall back to the
  // selected analytics range.
  const unlimitedBookingsBySubscriptionId = new Map<number, number>()
  for (const [subscriptionId, subscription] of subscriptionById.entries()) {
    const plan = subscription.planId != null ? planById.get(subscription.planId) : undefined
    if (!plan || plan.sessions != null || subscription.userId == null) continue

    let usage = bookingsByUser.get(subscription.userId) ?? 0
    if (
      subscription.startDate &&
      subscription.endDate &&
      YMD_ONLY_FOR_REVENUE.test(subscription.startDate) &&
      YMD_ONLY_FOR_REVENUE.test(subscription.endDate)
    ) {
      const billingTimeslotIds = await resolveTimeslotIdsForAnalytics(payload, {
        dateFrom: subscription.startDate,
        dateTo: subscription.endDate,
        tenantId: params.tenantId,
      })
      usage = 0
      for (const ids of chunkIds(billingTimeslotIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
        const result = await payload.count({
          collection: 'bookings',
          where: {
            and: [
              { status: { equals: 'confirmed' } },
              { user: { equals: subscription.userId } },
              { timeslot: { in: ids } },
              ...(params.tenantId != null ? [{ tenant: { equals: params.tenantId } }] : []),
            ],
          },
          overrideAccess: true,
        })
        usage += result.totalDocs ?? 0
      }
    }
    unlimitedBookingsBySubscriptionId.set(subscriptionId, usage)
  }

  let totalCents = 0
  for (const candidate of candidates) {
    const tx = transactionByBookingId.get(candidate.bookingId)
    if (!tx) continue
    const method = tx.paymentMethod
    if (method === 'stripe') {
      const dropInId = relationId(tx.dropInId)
      if (dropInId != null) totalCents += dropInPriceById.get(dropInId) ?? 0
      continue
    }
    if (method === 'class_pass') {
      const passId = relationId(tx.classPassId)
      const typeId = passId != null ? classPassTypeByPassId.get(passId) : undefined
      if (typeId != null) totalCents += classPassValueByTypeId.get(typeId) ?? 0
      continue
    }
    if (method === 'subscription') {
      const subscriptionId = relationId(tx.subscriptionId)
      const subscription = subscriptionId != null ? subscriptionById.get(subscriptionId) : undefined
      const plan = subscription?.planId != null ? planById.get(subscription.planId) : undefined
      if (!plan) continue
      const denominator = plan.sessions ?? Math.max(
        UNLIMITED_MEMBERSHIP_MIN_SESSIONS,
        unlimitedBookingsBySubscriptionId.get(subscriptionId!) ??
          (candidate.userId != null ? bookingsByUser.get(candidate.userId) ?? 0 : 0),
      )
      totalCents += Math.round(plan.priceCents / denominator)
    }
  }
  return totalCents
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
      summary: {
        totalBookings: 0,
        uniqueCustomers: 0,
        grossVolumeCents: 0,
        revenueEstimateCents: 0,
        accountToBookingConversionPercent: null,
        returningCustomerPercent: null,
      },
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
  const revenueCandidates: RevenueBookingCandidate[] = []
  // Track distinct booking dates per user for the returning-customer metric.
  // Only populated when we already need timeslot dates (includeBookingsOverTime).
  const trackReturningCustomers = includeSummary && includeBookingsOverTime
  const userBookingDatesMap = trackReturningCustomers ? new Map<number, Set<string>>() : null

  // Churn heuristic windows:
  // - eligibility (recency):
  //   * always: include users with no confirmed booking in the previous 7 days
  //   * after Wednesday: also include users with no confirmed booking in the previous 4 days
  // - trend decline: last ~30 days ending at params.dateTo (inclusive)
  const dayOfWeek = new Date(`${params.dateTo}T00:00:00.000Z`).getUTCDay() // Sun=0 ... Sat=6
  const inactivityFromYmd7 = shiftYmdUtc(params.dateTo, -(CHURN_INACTIVITY_DAYS - 1))
  const pastWednesday = dayOfWeek > 3 // Thu+
  const cutoffWednesdayYmd = pastWednesday ? shiftYmdUtc(params.dateTo, -(dayOfWeek - 3)) : null
  // For "Last check-in date", when today is Wednesday or later, ensure the earliest cutoff
  // is the date 4 days before the current week's Wednesday.
  // (e.g. Fri May 15 => current week Wed May 13 => cutoff May 9)
  const todayIsWedOrLater = dayOfWeek >= 3 // Wed=3
  const thisWeekWednesdayYmd = todayIsWedOrLater ? shiftYmdUtc(params.dateTo, -(dayOfWeek - 3)) : null
  const lastCheckInCutoffYmd = thisWeekWednesdayYmd != null ? shiftYmdUtc(thisWeekWednesdayYmd, -4) : inactivityFromYmd7
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
      select: { id: true, user: true, timeslot: true },
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
      if (typeof (d as { id?: unknown }).id === 'number') {
        revenueCandidates.push({ bookingId: (d as { id: number }).id, userId: uid })
      }
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

      if (trackReturningCustomers && userBookingDatesMap !== null && uid !== null) {
        let dates = userBookingDatesMap.get(uid)
        if (!dates) {
          dates = new Set()
          userBookingDatesMap.set(uid, dates)
        }
        dates.add(ymd)
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

  // Extra pass: fill in churn booking history that falls before the user-selected date range.
  // The churn heuristic always looks back CHURN_TREND_WINDOW_DAYS from dateTo regardless of the
  // chosen period. If dateFrom is more recent than churnFromYmd, fetch the gap so that switching
  // between e.g. "last 7 days" and "last 30 days" does not alter the churn list.
  if (includeLikelyChurnCustomers && churnFromYmd < params.dateFrom) {
    const gapParams = {
      ...params,
      dateFrom: churnFromYmd,
      dateTo: shiftYmdUtc(params.dateFrom, -1),
      preResolvedTimeslotIds: undefined as number[] | undefined,
    }
    const gapTimeslotIds = await resolveTimeslotIdsForAnalytics(payload, gapParams)

    const ymdToDayNumber = (v: string): number => {
      const [yy, mm, dd] = v.split('-').map((x) => parseInt(x, 10))
      if (yy == null || mm == null || dd == null) return 0
      return Math.floor(Date.UTC(yy, mm - 1, dd) / 86400000)
    }
    const churnFromDayNumber = ymdToDayNumber(churnFromYmd)

    for (const idChunk of chunkIds(gapTimeslotIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
      const where = buildConfirmedBookingsWhereForTimeslots(idChunk, params.tenantId)
      const [timeslotInfo, docsResult] = await Promise.all([
        loadTimeslotCalendarInfoById(payload, idChunk, ymdIanaMode),
        payload.find({
          collection: 'bookings',
          where,
          limit: MAX_BOOKINGS_PER_CHUNK,
          depth: 0,
          select: { user: true, timeslot: true },
          overrideAccess: true,
        }),
      ])

      for (const doc of docsResult.docs) {
        const d = doc as { user?: number | { id: number }; timeslot?: number | { id?: number } }
        const uid = bookingUserId(d)
        if (uid === null) continue

        const ts = d.timeslot
        const tsId =
          typeof ts === 'object' && ts !== null && 'id' in ts ? (ts as { id: number }).id : ts
        const ymd = typeof tsId === 'number' ? timeslotInfo.ymdById.get(tsId) ?? null : null
        if (!ymd || ymd < churnFromYmd || ymd >= params.dateFrom) continue

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

        if (ymd >= inactivityFromYmd7) agg.recentBookings += 1
        else agg.priorBookings += 1

        if (cutoffWednesdayYmd != null && ymd >= cutoffWednesdayYmd) agg.recentBookingsThisWeek += 1

        const dayOffset = ymdToDayNumber(ymd) - churnFromDayNumber
        if (dayOffset >= 0 && dayOffset < CHURN_TREND_WINDOW_DAYS) {
          agg.dayCounts[dayOffset]! += 1
        }

        const tenantIdForTimeslot =
          typeof tsId === 'number' ? timeslotInfo.tenantById.get(tsId) : null
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

  // Returning-customer rate: % of unique customers in the period who booked on 2+ distinct days.
  let returningCustomerPercent: number | null = null
  if (trackReturningCustomers && userBookingDatesMap !== null) {
    const totalUnique = uniqueUserIds.size
    if (totalUnique > 0) {
      let returningCount = 0
      for (const dates of userBookingDatesMap.values()) {
        if (dates.size >= 2) returningCount++
      }
      returningCustomerPercent = Math.round((returningCount / totalUnique) * 100)
    }
  }

  // Account-to-booking conversion: % of users who registered in the period and have ≥1 confirmed booking.
  let accountToBookingConversionPercent: number | null = null
  if (includeSummary) {
    const dateFromIso = `${params.dateFrom}T00:00:00.000Z`
    const dateToIso = `${params.dateTo}T23:59:59.999Z`

    const newUsersAndConditions: import('payload').Where[] = [
      { createdAt: { greater_than_equal: dateFromIso } },
      { createdAt: { less_than_equal: dateToIso } },
    ]
    if (params.tenantId != null) {
      newUsersAndConditions.push({ registrationTenant: { equals: params.tenantId } })
    }

    const allNewUserIds: number[] = []
    let newUsersPage = 1
    for (;;) {
      const res = await payload.find({
        collection: 'users',
        where: { and: newUsersAndConditions },
        select: { email: true },
        limit: 1000,
        page: newUsersPage,
        depth: 0,
        overrideAccess: true,
      })
      for (const u of res.docs) {
        allNewUserIds.push((u as { id: number }).id)
      }
      if (newUsersPage >= (res.totalPages ?? 1)) break
      newUsersPage++
    }

    if (allNewUserIds.length > 0) {
      const usersWithBookings = new Set<number>()
      for (const userIdChunk of chunkIds(allNewUserIds, TIMESLOT_ID_IN_CHUNK_SIZE)) {
        const bookingAndConditions: import('payload').Where[] = [
          { user: { in: userIdChunk } },
          { status: { equals: 'confirmed' } },
        ]
        if (params.tenantId != null) {
          bookingAndConditions.push({ tenant: { equals: params.tenantId } })
        }
        const bookingDocs = await payload.find({
          collection: 'bookings',
          where: { and: bookingAndConditions },
          select: { user: true },
          limit: MAX_BOOKINGS_PER_CHUNK,
          depth: 0,
          overrideAccess: true,
        })
        for (const doc of bookingDocs.docs) {
          const uid = bookingUserId(doc as { user?: number | { id: number } })
          if (uid !== null) usersWithBookings.add(uid)
        }
      }
      accountToBookingConversionPercent = Math.round((usersWithBookings.size / allNewUserIds.length) * 100)
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
  const revenueEstimateCents = includeSummary
    ? await calculateRevenueEstimate(payload, revenueCandidates, params)
    : 0

  // Subscription-filter + score calculation (implemented after we fetch subscriptions
  // to avoid per-user queries).
  //
  // Note: we keep an unrounded sort key (rawScore + supporting signals) to produce a
  // more accurate ranking, while still returning the rounded `score` for display.
  let scoredRowsWithUserNames: Array<{
    userId: number
    score: number
    recentBookings: number
    priorBookings: number
    rawScore: number
    recentRolling: number
    avgEarlyRolling: number
    declineRatioClamped: number
    /** Most recent day index (within churn trend window) that has >=1 booking; -1 if none. */
    lastActivityDayOffset: number
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
          // Only include users with no confirmed bookings in the previous 7 days.
          // This prevents users who booked recently (e.g. Mon/Tue before this week's Wednesday)
          // from appearing just because they fall outside the Wednesday-based "this week" window.
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

          const lastActivityDayOffset = (() => {
            // dayCounts is aligned to [churnFromYmd..params.dateTo]; higher offset == more recent.
            for (let i = agg.dayCounts.length - 1; i >= 0; i -= 1) {
              if (agg.dayCounts[i]! > 0) return i
            }
            return -1
          })()

          if (avgEarlyRolling <= 0) {
            return {
              userId,
              score: 0,
              recentBookings: agg.recentBookings,
              priorBookings: agg.priorBookings,
              rawScore: 0,
              recentRolling,
              avgEarlyRolling,
              declineRatioClamped: 0,
              lastActivityDayOffset,
            }
          }

          const declineRatio = (avgEarlyRolling - recentRolling) / (avgEarlyRolling + 1)
          const declineRatioClamped = clamp(declineRatio, 0, 1)
          const inactivityBoost = recentRolling === 0 ? 1 : 0.5
          const rawScore = declineRatioClamped * inactivityBoost
          const score = Math.round(rawScore * 100)

          return {
            userId,
            score,
            recentBookings: agg.recentBookings,
            priorBookings: agg.priorBookings,
            rawScore,
            recentRolling,
            avgEarlyRolling,
            declineRatioClamped,
            lastActivityDayOffset,
          }
        })

      scoredRowsWithUserNames.sort((a, b) => {
        // Primary: show more recent timeslot activity higher.
        if (b.lastActivityDayOffset !== a.lastActivityDayOffset) return b.lastActivityDayOffset - a.lastActivityDayOffset
        // Tie-break: more likely churn first.
        if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore
        // Secondary tie-break: stronger decline signal.
        if (b.declineRatioClamped !== a.declineRatioClamped) return b.declineRatioClamped - a.declineRatioClamped
        // Then: less recent activity within the last 7 days (lower recentRolling implies more churn).
        if (a.recentRolling !== b.recentRolling) return a.recentRolling - b.recentRolling
        // Then: more history (prior bookings) to break remaining ties deterministically.
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
          // Ensure the check-in date shown on the churn table falls within the intended
          // cutoff logic (timeslot date only).
          if (ymd != null && ymd <= lastCheckInCutoffYmd) {
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
      revenueEstimateCents,
      accountToBookingConversionPercent: includeSummary ? accountToBookingConversionPercent : null,
      returningCustomerPercent: includeSummary ? returningCustomerPercent : null,
    },
    bookingsOverTime,
    topCustomers,
    likelyChurnCustomers,
    likelyChurnCustomersTotal,
  }
}

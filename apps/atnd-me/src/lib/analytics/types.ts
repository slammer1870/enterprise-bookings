/**
 * Shared types for analytics API and lib.
 */
export type AnalyticsDateRange = {
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string
}

export type AnalyticsQueryParams = AnalyticsDateRange & {
  tenantId?: number | null
  /** Optional location/branch id to filter timeslots + bookings. */
  branchId?: number | null
  granularity?: 'day' | 'week'
  limitTopCustomers?: number
  /** Likely-to-churn results limit for pagination. */
  limitLikelyChurnCustomers?: number
  /** Likely-to-churn results offset for pagination. */
  offsetLikelyChurnCustomers?: number
  /**
   * When set (e.g. by the analytics API route), skips re-querying timeslots so summary,
   * trend, and top-customers share one ID list.
   */
  preResolvedTimeslotIds?: number[]
}

export type SummaryMetrics = {
  totalBookings: number
  uniqueCustomers: number
  grossVolumeCents: number
}

export type BookingsOverTimeRow = {
  date: string
  count: number
}

export type TopCustomerRow = {
  userId: number
  count: number
  /** User name (or email fallback) when available */
  userName?: string
}

export type LikelyChurnCustomerRow = {
  userId: number
  /** 0-100 heuristic score (higher = more likely). */
  score: number
  /** Confirmed bookings from the inactivity cutoff window (last 7 days by default). */
  recentBookings: number
  /** Confirmed bookings earlier in the churn trend window. */
  priorBookings: number
  /** Most recent confirmed booking timeslot calendar date overall (YYYY-MM-DD). */
  lastCheckInDate?: string | null
  /** User name (or email fallback) when available */
  userName?: string
}

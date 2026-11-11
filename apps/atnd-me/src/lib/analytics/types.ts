/**
 * Shared types for analytics API and lib.
 */
export type AnalyticsDateRange = {
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string
}

export type RetentionCohort = 'recent_class' | 'no_recent_class' | 'all'

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
  /** Segment the retention ranking by class activity in the trailing 7 days. */
  retentionCohort?: RetentionCohort
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
  /** Estimated revenue for confirmed bookings after trial, quantity, and promo discounts, in cents. */
  revenueEstimateCents: number
  /**
   * Percentage (0–100) of users who registered in the period and have at least one
   * confirmed booking (all-time, not bounded to the period). Null when there are no
   * new registrations in the selected date range.
   */
  accountToBookingConversionPercent: number | null
  /**
   * Percentage (0–100) of unique customers in the period who made confirmed bookings
   * on at least two distinct calendar days. Null when there are no bookings in range.
   */
  returningCustomerPercent: number | null
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
  /** 0-100 outreach priority signal; higher means lower modeled booking propensity. */
  score: number
  /** The no-recent-class cohort uses the offline-trained model; other cohorts retain the trend fallback. */
  scoreSource: 'model' | 'heuristic'
  /** Relative next-7-day booking propensity. Class weighting means this is not calibrated probability. */
  bookingPropensity?: number | null
  /** Versioned model artifact used for this row, or null for the heuristic fallback. */
  modelVersion?: string | null
  /** Confirmed bookings from the inactivity cutoff window (last 7 days by default). */
  recentBookings: number
  /** Confirmed bookings earlier in the churn trend window. */
  priorBookings: number
  /** Whether the customer had a confirmed class in the trailing 7 days. */
  cohort: Exclude<RetentionCohort, 'all'>
  /** Most recent confirmed booking timeslot calendar date overall (YYYY-MM-DD). */
  lastCheckInDate?: string | null
  /** User name (or email fallback) when available */
  userName?: string
}

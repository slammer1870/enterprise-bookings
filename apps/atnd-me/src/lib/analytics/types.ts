/**
 * Shared types for analytics API and lib.
 */
export type AnalyticsDateRange = {
  dateFrom: string // ISO date YYYY-MM-DD
  dateTo: string
}

export type AnalyticsQueryParams = AnalyticsDateRange & {
  tenantId?: number | null
  granularity?: 'day' | 'week'
  limitTopCustomers?: number
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

/**
 * Bookings over time (daily or weekly buckets) for trend chart.
 * Buckets by timeslot (lesson) date, not booking creation time.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, BookingsOverTimeRow } from './types'
import { getAnalyticsDashboardBundle } from './dashboardBundle'

/** Prefer {@link getAnalyticsDashboardBundle} when loading the full dashboard to avoid duplicate queries. */
export async function getBookingsOverTime(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<BookingsOverTimeRow[]> {
  const { bookingsOverTime } = await getAnalyticsDashboardBundle(payload, params, {
    includeTopCustomers: false,
  })
  return bookingsOverTime
}

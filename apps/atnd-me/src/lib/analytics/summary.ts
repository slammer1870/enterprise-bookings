/**
 * Summary metrics for analytics dashboard: total bookings, unique customers, gross volume.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, SummaryMetrics } from './types'
import { getAnalyticsDashboardBundle } from './dashboardBundle'

/** Prefer {@link getAnalyticsDashboardBundle} when loading the full dashboard to avoid duplicate queries. */
export async function getSummaryMetrics(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<SummaryMetrics> {
  const { summary } = await getAnalyticsDashboardBundle(payload, params, { includeTopCustomers: false })
  return summary
}

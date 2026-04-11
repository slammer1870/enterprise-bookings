/**
 * Top customers by booking count in the date range.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, TopCustomerRow } from './types'
import { getAnalyticsDashboardBundle } from './dashboardBundle'

/** Prefer {@link getAnalyticsDashboardBundle} when loading the full dashboard to avoid duplicate queries. */
export async function getTopCustomers(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<TopCustomerRow[]> {
  const { topCustomers } = await getAnalyticsDashboardBundle(payload, params, { includeTopCustomers: true })
  return topCustomers
}

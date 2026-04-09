/**
 * Summary metrics for analytics dashboard: total bookings, unique customers, gross volume.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, SummaryMetrics } from './types'
import { buildAnalyticsBookingsWhere } from './analyticsBookingsWhere'

const MAX_BOOKINGS_QUERY = 50_000

export async function getSummaryMetrics(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<SummaryMetrics> {
  const where = buildAnalyticsBookingsWhere(params)

  const [countResult, docsResult] = await Promise.all([
    payload.find({
      collection: 'bookings',
      where,
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'bookings',
      where,
      limit: MAX_BOOKINGS_QUERY,
      depth: 0,
      select: { user: true },
      overrideAccess: true,
    }),
  ])

  const totalBookings = countResult.totalDocs ?? 0
  const userIds = docsResult.docs.map((d) => {
    const u = (d as { user?: number | { id: number } }).user
    return typeof u === 'object' && u !== null ? u.id : u
  })
  const uniqueCustomers = new Set(userIds.filter((id): id is number => typeof id === 'number')).size

  // Gross volume: sum of class price from timeslot's eventType for each booking.
  // We don't have amount on Transaction in payload-types; for MVP we use 0 or optionally join timeslot->eventType later.
  const grossVolumeCents = 0

  return {
    totalBookings,
    uniqueCustomers,
    grossVolumeCents,
  }
}

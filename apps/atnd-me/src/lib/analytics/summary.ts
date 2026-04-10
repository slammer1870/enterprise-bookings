/**
 * Summary metrics for analytics dashboard: total bookings, unique customers, gross volume.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, SummaryMetrics } from './types'
import {
  buildConfirmedBookingsWhereForTimeslots,
  chunkIds,
  resolveTimeslotIdsForAnalytics,
  TIMESLOT_ID_IN_CHUNK_SIZE,
} from './analyticsBookingsWhere'

const MAX_BOOKINGS_PER_CHUNK = 50_000

export async function getSummaryMetrics(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<SummaryMetrics> {
  const timeslotIds = await resolveTimeslotIdsForAnalytics(payload, params)
  if (timeslotIds.length === 0) {
    return { totalBookings: 0, uniqueCustomers: 0, grossVolumeCents: 0 }
  }

  let totalBookings = 0
  const uniqueUserIds = new Set<number>()

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
        depth: 0,
        select: { user: true },
        overrideAccess: true,
      }),
    ])

    totalBookings += countResult.totalDocs ?? 0
    for (const d of docsResult.docs) {
      const u = (d as { user?: number | { id: number } }).user
      const uid = typeof u === 'object' && u !== null ? u.id : u
      if (typeof uid === 'number') uniqueUserIds.add(uid)
    }
  }

  // Gross volume: sum of class price from timeslot's eventType for each booking.
  // We don't have amount on Transaction in payload-types; for MVP we use 0 or optionally join timeslot->eventType later.
  const grossVolumeCents = 0

  return {
    totalBookings,
    uniqueCustomers: uniqueUserIds.size,
    grossVolumeCents,
  }
}

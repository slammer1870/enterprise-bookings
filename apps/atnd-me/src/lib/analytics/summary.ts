/**
 * Summary metrics for analytics dashboard: total bookings, unique customers, gross volume.
 */
import type { Payload, Where } from 'payload'
import type { AnalyticsQueryParams, SummaryMetrics } from './types'

const MAX_BOOKINGS_QUERY = 50_000

function buildBookingsWhere(params: AnalyticsQueryParams): Where {
  const dateFrom = new Date(params.dateFrom)
  dateFrom.setHours(0, 0, 0, 0)
  const dateTo = new Date(params.dateTo)
  dateTo.setHours(23, 59, 59, 999)

  const where: Where = {
    status: { equals: 'confirmed' },
    createdAt: {
      greater_than_equal: dateToISO(dateFrom),
      less_than_equal: dateToISO(dateTo),
    },
  }

  if (params.tenantId != null) {
    where.tenant = { equals: params.tenantId }
  }

  return where
}

function dateToISO(d: Date): string {
  return d.toISOString()
}

export async function getSummaryMetrics(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<SummaryMetrics> {
  const where = buildBookingsWhere(params)

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

/**
 * Bookings over time (daily or weekly buckets) for trend chart.
 */
import type { Payload, Where } from 'payload'
import type { AnalyticsQueryParams, BookingsOverTimeRow } from './types'

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

function toDateKey(iso: string, granularity: 'day' | 'week'): string {
  const d = new Date(iso)
  if (granularity === 'week') {
    const start = new Date(d)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    return start.toISOString().slice(0, 10)
  }
  return iso.slice(0, 10)
}

export async function getBookingsOverTime(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<BookingsOverTimeRow[]> {
  const where = buildBookingsWhere(params)
  const granularity = params.granularity ?? 'day'

  const result = await payload.find({
    collection: 'bookings',
    where,
    limit: MAX_BOOKINGS_QUERY,
    depth: 0,
    select: { createdAt: true },
    overrideAccess: true,
  })

  const bucket = new Map<string, number>()
  for (const doc of result.docs) {
    const createdAt = (doc as { createdAt: string }).createdAt
    if (!createdAt) continue
    const key = toDateKey(createdAt, granularity)
    bucket.set(key, (bucket.get(key) ?? 0) + 1)
  }

  const sorted = Array.from(bucket.entries()).sort(([a], [b]) => a.localeCompare(b))
  return sorted.map(([date, count]) => ({ date, count }))
}

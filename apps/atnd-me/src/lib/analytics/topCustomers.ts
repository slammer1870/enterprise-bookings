/**
 * Top customers by booking count in the date range.
 */
import type { Payload, Where } from 'payload'
import type { AnalyticsQueryParams, TopCustomerRow } from './types'

const MAX_BOOKINGS_QUERY = 50_000
const DEFAULT_TOP_LIMIT = 10

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

export async function getTopCustomers(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<TopCustomerRow[]> {
  const where = buildBookingsWhere(params)
  const limit = params.limitTopCustomers ?? DEFAULT_TOP_LIMIT

  const result = await payload.find({
    collection: 'bookings',
    where,
    limit: MAX_BOOKINGS_QUERY,
    depth: 0,
    select: { user: true },
    overrideAccess: true,
  })

  const byUser = new Map<number, number>()
  for (const doc of result.docs) {
    const u = (doc as { user?: number | { id: number } }).user
    const userId = typeof u === 'object' && u !== null ? u.id : u
    if (typeof userId === 'number') {
      byUser.set(userId, (byUser.get(userId) ?? 0) + 1)
    }
  }

  return Array.from(byUser.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Top customers by booking count in the date range.
 */
import type { Payload } from 'payload'
import type { AnalyticsQueryParams, TopCustomerRow } from './types'
import { buildAnalyticsBookingsWhere } from './analyticsBookingsWhere'

const MAX_BOOKINGS_QUERY = 50_000
const DEFAULT_TOP_LIMIT = 10

export async function getTopCustomers(
  payload: Payload,
  params: AnalyticsQueryParams,
): Promise<TopCustomerRow[]> {
  const where = buildAnalyticsBookingsWhere(params)
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

  const rows = Array.from(byUser.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  if (rows.length === 0) return rows

  const userIds = rows.map((r) => r.userId)
  const users = await payload.find({
    collection: 'users',
    where: { id: { in: userIds } },
    depth: 0,
    limit: userIds.length,
    select: { id: true, name: true, email: true },
    overrideAccess: true,
  })

  const userMap = new Map<number, string>()
  for (const u of users.docs) {
    const user = u as { id: number; name?: string | null; email?: string | null }
    const label = user.name?.trim() || user.email || `User ${user.id}`
    userMap.set(user.id, label)
  }

  return rows.map((r) => ({
    ...r,
    userName: userMap.get(r.userId),
  }))
}

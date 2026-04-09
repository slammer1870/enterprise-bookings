/**
 * Shared WHERE for analytics: confirmed bookings whose timeslot (lesson) falls in the date range.
 * Date params are calendar YYYY-MM-DD and match timeslots.date, not booking createdAt.
 */
import type { Where } from 'payload'
import type { AnalyticsQueryParams } from './types'

export function buildAnalyticsBookingsWhere(params: AnalyticsQueryParams): Where {
  const { dateFrom, dateTo } = params

  const where: Where = {
    status: { equals: 'confirmed' },
    'timeslot.date': {
      greater_than_equal: dateFrom,
      less_than_equal: dateTo,
    },
  }

  if (params.tenantId != null) {
    where.tenant = { equals: params.tenantId }
  }

  return where
}

/**
 * Parse booking-related metadata from Stripe events (payment_intent, subscription).
 */

export type PaymentIntentMetadata = {
  tenantId?: string
  bookingId?: string
  bookingIds?: string
  lessonId?: string
  type?: string
  userId?: string
  quantity?: string
  expirationDays?: string
  totalCents?: string
}

export type SubscriptionMetadata = {
  lessonId?: string
  lesson_id?: string
  bookingIds?: string
}

/** Parse booking IDs from metadata (supports both bookingId and comma-separated bookingIds). */
export function parseBookingIds(meta: {
  bookingId?: string
  bookingIds?: string
}): number[] {
  const ids: number[] = []
  if (meta.bookingId) {
    const id = parseInt(meta.bookingId, 10)
    if (!Number.isNaN(id)) ids.push(id)
  }
  if (meta.bookingIds) {
    const parsed = meta.bookingIds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n))
    ids.push(...parsed)
  }
  return ids
}

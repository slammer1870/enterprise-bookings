/**
 * Parse booking-related metadata from Stripe events (payment_intent, subscription).
 */

export type PaymentIntentMetadata = {
  tenantId?: string
  bookingId?: string
  bookingIds?: string
  timeslotId?: string
  /** Legacy Stripe/checkout metadata key; same value as timeslotId */
  lessonId?: string
  type?: string
  userId?: string
  quantity?: string
  expirationDays?: string
  totalCents?: string
}

export type SubscriptionMetadata = {
  timeslotId?: string
  timeslot_id?: string
  /** Legacy Stripe metadata key; same value as timeslotId */
  lessonId?: string
  bookingIds?: string
}

/** Resolve timeslot id from Stripe metadata (new keys first, then legacy lessonId). */
export function getTimeslotIdFromStripeMetadata(meta: {
  timeslotId?: string
  timeslot_id?: string
  lessonId?: string
}): string | undefined {
  return meta.timeslotId ?? meta.timeslot_id ?? meta.lessonId
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

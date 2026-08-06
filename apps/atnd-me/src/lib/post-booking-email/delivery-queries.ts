import type { PayloadRequest } from 'payload'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'

export async function findExistingPostBookingEmailDelivery(
  req: PayloadRequest,
  key: {
    tenantId: number
    userId: number
    timeslotId: number
    eventTypeId: number
    emailConfigId: string
  },
) {
  const existing = await req.payload.find({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    where: {
      and: [
        { tenant: { equals: key.tenantId } },
        { user: { equals: key.userId } },
        { timeslot: { equals: key.timeslotId } },
        { eventType: { equals: key.eventTypeId } },
        { emailConfigId: { equals: key.emailConfigId } },
        { status: { in: ['scheduled', 'sent'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return existing.docs[0] ?? null
}

/**
 * Once-ever check for first-booking timings: any prior scheduled/sent delivery
 * for this user + tenant + sendTiming (ignores event type, timeslot, and email config).
 */
export async function findExistingLifetimeFirstBookingPostBookingEmailDelivery(
  req: PayloadRequest,
  key: {
    tenantId: number
    userId: number
    sendTiming: 'after_first_booking' | 'next_day_after_first_booking'
  },
) {
  const existing = await req.payload.find({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    where: {
      and: [
        { tenant: { equals: key.tenantId } },
        { user: { equals: key.userId } },
        { sendTiming: { equals: key.sendTiming } },
        { status: { in: ['scheduled', 'sent'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return existing.docs[0] ?? null
}

/**
 * True if the user already had a confirmed booking for this tenant before
 * `beforeCreatedAt` (typically the trigger booking's createdAt). Used so existing
 * customers are not treated as first-timers when this email is enabled later.
 */
export async function userHasPriorConfirmedBookingForTenant(
  req: PayloadRequest,
  key: {
    tenantId: number
    userId: number
    beforeCreatedAt: string
  },
): Promise<boolean> {
  const result = await req.payload.find({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    where: {
      and: [
        { tenant: { equals: key.tenantId } },
        { user: { equals: key.userId } },
        { status: { equals: 'confirmed' } },
        { createdAt: { less_than: key.beforeCreatedAt } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.totalDocs > 0
}

export async function findScheduledNextDayDeliveriesForEventType(
  req: PayloadRequest,
  key: {
    userId: number
    timeslotId: number
    tenantId: number
    eventTypeId: number
  },
) {
  const result = await req.payload.find({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    where: {
      and: [
        { tenant: { equals: key.tenantId } },
        { user: { equals: key.userId } },
        { timeslot: { equals: key.timeslotId } },
        { eventType: { equals: key.eventTypeId } },
        { sendTiming: { equals: 'next_day_after_first_booking' } },
        { status: { equals: 'scheduled' } },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs
}

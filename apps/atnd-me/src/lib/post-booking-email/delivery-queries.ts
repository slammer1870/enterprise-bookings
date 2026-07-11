import type { PayloadRequest } from 'payload'
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

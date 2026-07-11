import type { PayloadRequest } from 'payload'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'
import { findScheduledNextDayDeliveriesForEventType } from './delivery-queries'
import { resolveEventTypeIdFromBooking } from './resolve-event-type-post-booking-email'

function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  return null
}

async function userHasOtherConfirmedBookingsForTimeslot(
  req: PayloadRequest,
  key: {
    userId: number
    timeslotId: number
    tenantId: number
    excludeBookingId: number
  },
): Promise<boolean> {
  const result = await req.payload.find({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    where: {
      and: [
        { user: { equals: key.userId } },
        { timeslot: { equals: key.timeslotId } },
        { tenant: { equals: key.tenantId } },
        { status: { equals: 'confirmed' } },
        { id: { not_equals: key.excludeBookingId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.totalDocs > 0
}

async function findPostBookingEmailJobByDeliveryId(
  req: PayloadRequest,
  deliveryId: number,
): Promise<{ id: number } | null> {
  const result = await req.payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: 'sendPostBookingEmail' } },
        { completedAt: { exists: false } },
      ],
    },
    sort: '-createdAt',
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })

  const match = result.docs.find((doc) => {
    const input = doc.input
    if (input == null || typeof input !== 'object' || Array.isArray(input)) return false
    const deliveryIdFromInput = (input as { deliveryId?: unknown }).deliveryId
    return deliveryIdFromInput === deliveryId || deliveryIdFromInput === String(deliveryId)
  })

  return match?.id != null ? { id: match.id as number } : null
}

async function cancelPayloadJob(req: PayloadRequest, jobId: number): Promise<void> {
  const jobsApi = req.payload.jobs as {
    cancelByID?: (args: { id: number | string; req?: PayloadRequest }) => Promise<unknown>
  }

  if (typeof jobsApi.cancelByID === 'function') {
    try {
      await jobsApi.cancelByID({ id: jobId, req })
    } catch {
      // Fall through to delete for queued jobs that have not started yet.
    }
  }

  await req.payload.delete({
    collection: 'payload-jobs',
    id: jobId,
    overrideAccess: true,
    req,
  })
}

async function cancelScheduledDelivery(req: PayloadRequest, delivery: { id: number; payloadJobId?: number | null }) {
  const payloadJobId =
    typeof delivery.payloadJobId === 'number' ? delivery.payloadJobId : null

  const job =
    payloadJobId != null
      ? { id: payloadJobId }
      : await findPostBookingEmailJobByDeliveryId(req, delivery.id)

  if (job?.id != null) {
    try {
      await cancelPayloadJob(req, job.id)
    } catch (error) {
      req.payload.logger.error(
        `[post-booking-email] Failed to cancel job ${job.id} for delivery ${delivery.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  await req.payload.update({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    id: delivery.id,
    data: { status: 'cancelled' },
    overrideAccess: true,
    req,
  })
}

export function isCancelledTransition({
  doc,
  previousDoc,
}: {
  doc: { status?: string }
  previousDoc?: { status?: string } | null
}): boolean {
  return doc.status === 'cancelled' && previousDoc?.status !== 'cancelled'
}

export async function maybeCancelScheduledPostBookingEmail({
  req,
  booking,
}: {
  req: PayloadRequest
  booking: {
    id?: number
    user?: unknown
    timeslot?: unknown
    tenant?: unknown
  }
}): Promise<void> {
  const bookingId = relationId(booking.id)
  const timeslotId = relationId(booking.timeslot)
  const userId = relationId(booking.user)
  const tenantId = relationId(booking.tenant)

  if (bookingId == null || timeslotId == null || userId == null || tenantId == null) {
    return
  }

  const stillHasOtherConfirmed = await userHasOtherConfirmedBookingsForTimeslot(req, {
    userId,
    timeslotId,
    tenantId,
    excludeBookingId: bookingId,
  })
  if (stillHasOtherConfirmed) return

  const resolved = await resolveEventTypeIdFromBooking(req, booking)
  if (!resolved) return

  const deliveries = await findScheduledNextDayDeliveriesForEventType(req, {
    userId,
    timeslotId,
    tenantId,
    eventTypeId: resolved.eventTypeId,
  })

  for (const delivery of deliveries) {
    await cancelScheduledDelivery(req, {
      id: delivery.id as number,
      payloadJobId: (delivery as { payloadJobId?: number | null }).payloadJobId,
    })
  }
}

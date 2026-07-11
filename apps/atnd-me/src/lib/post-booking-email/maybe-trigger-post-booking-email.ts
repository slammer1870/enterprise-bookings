import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'
import type { PostBookingEmailSendTiming } from '@/fields/postBookingEmailFields'
import {
  resolvePostBookingEmailBatchContext,
  shouldTriggerPostBookingEmailForBatch,
} from './batch-context'
import {
  isCancelledTransition,
  maybeCancelScheduledPostBookingEmail,
} from './cancel-scheduled-post-booking-email'
import { findExistingPostBookingEmailDelivery } from './delivery-queries'
import { resolveNextDay9am } from './resolve-send-time'
import { resolveEventTypePostBookingEmailForBooking } from './resolve-event-type-post-booking-email'
import { sendPostBookingEmail } from './send-post-booking-email'
import { resolveTimeslotTimeZone } from '@repo/shared-utils'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

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

function scheduleOnNextEventLoop(fn: () => void): void {
  const g = globalThis as typeof globalThis & {
    setImmediate?: (_cb: () => void) => void
  }
  if (typeof g.setImmediate === 'function') {
    g.setImmediate(fn)
  } else {
    setTimeout(fn, 0)
  }
}

function isConfirmedTransition({
  doc,
  previousDoc,
  operation,
}: {
  doc: { status?: string }
  previousDoc?: { status?: string } | null
  operation: 'create' | 'update'
}): boolean {
  if (doc.status !== 'confirmed') return false
  if (operation === 'create') return true
  return previousDoc?.status !== 'confirmed'
}

async function createDeliveryRecord(
  req: PayloadRequest,
  data: {
    tenantId: number
    userId: number
    timeslotId: number
    eventTypeId: number
    sendTiming: PostBookingEmailSendTiming
    status: 'scheduled' | 'sent'
    scheduledFor?: string
    sentAt?: string
    bookingId?: number
  },
) {
  return req.payload.create({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    data: {
      tenant: data.tenantId,
      user: data.userId,
      timeslot: data.timeslotId,
      eventType: data.eventTypeId,
      sendTiming: data.sendTiming,
      status: data.status,
      ...(data.scheduledFor ? { scheduledFor: data.scheduledFor } : {}),
      ...(data.sentAt ? { sentAt: data.sentAt } : {}),
      ...(data.bookingId != null ? { triggerBooking: data.bookingId } : {}),
    },
    overrideAccess: true,
    req,
  })
}

export async function maybeTriggerPostBookingEmail({
  req,
  booking,
  batchContext,
}: {
  req: PayloadRequest
  booking: {
    id: number
    status?: string
    user?: unknown
    timeslot?: unknown
    tenant?: unknown
  }
  batchContext: ReturnType<typeof resolvePostBookingEmailBatchContext>
}): Promise<void> {
  const timeslotId = relationId(booking.timeslot)
  const userId = relationId(booking.user)
  const tenantId = relationId(booking.tenant)

  if (timeslotId == null || userId == null || tenantId == null) {
    return
  }

  const resolved = await resolveEventTypePostBookingEmailForBooking(req, booking)
  if (!resolved) return

  const { eventTypeId, config } = resolved
  const sendTiming = config.sendTiming as PostBookingEmailSendTiming
  if (!sendTiming) return

  if (!shouldTriggerPostBookingEmailForBatch(sendTiming, batchContext)) {
    return
  }

  const existing = await findExistingPostBookingEmailDelivery(req, {
    tenantId,
    userId,
    timeslotId,
    eventTypeId,
    sendTiming,
  })
  if (existing) return

  const timeslot = await req.payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 1,
    overrideAccess: true,
  })

  const user =
    booking.user && typeof booking.user === 'object'
      ? booking.user
      : await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          overrideAccess: true,
        })

  if (sendTiming === 'next_day_after_first_booking') {
    const timeZone = resolveTimeslotTimeZone(timeslot as Parameters<typeof resolveTimeslotTimeZone>[0])
    const scheduledFor = resolveNextDay9am(new Date(), timeZone).toISOString()

    const delivery = await createDeliveryRecord(req, {
      tenantId,
      userId,
      timeslotId,
      eventTypeId,
      sendTiming,
      status: 'scheduled',
      scheduledFor,
      bookingId: booking.id,
    })

    const job = await req.payload.jobs.queue({
      task: 'sendPostBookingEmail',
      input: {
        deliveryId: delivery.id,
        userId,
        timeslotId,
        tenantId,
        eventTypeId,
        bookingId: booking.id,
      },
      waitUntil: new Date(scheduledFor),
    })

    const payloadJobId =
      job?.id != null
        ? typeof job.id === 'number'
          ? job.id
          : typeof job.id === 'string' && /^\d+$/.test(job.id)
            ? parseInt(job.id, 10)
            : null
        : null

    if (payloadJobId != null) {
      await req.payload.update({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        id: delivery.id as number,
        data: { payloadJobId },
        overrideAccess: true,
        req,
      })
    }
    return
  }

  const delivery = await createDeliveryRecord(req, {
    tenantId,
    userId,
    timeslotId,
    eventTypeId,
    sendTiming,
    status: 'scheduled',
    bookingId: booking.id,
  })

  scheduleOnNextEventLoop(() => {
    void (async () => {
      try {
        await sendPostBookingEmail({
          payload: req.payload,
          user,
          config,
        })
        await req.payload.update({
          collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
          id: delivery.id,
          data: {
            status: 'sent',
            sentAt: new Date().toISOString(),
          },
          overrideAccess: true,
        })
      } catch (error) {
        req.payload.logger.error(
          `[post-booking-email] Failed to send delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        await req.payload.delete({
          collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
          id: delivery.id,
          overrideAccess: true,
        }).catch(() => undefined)
      }
    })()
  })
}

export const triggerPostBookingEmailAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.skipPostBookingEmail) return doc

  if (isCancelledTransition({ doc, previousDoc })) {
    await maybeCancelScheduledPostBookingEmail({
      req,
      booking: doc as {
        id: number
        user?: unknown
        timeslot?: unknown
        tenant?: unknown
      },
    })
    return doc
  }

  if (!isConfirmedTransition({ doc, previousDoc, operation })) {
    return doc
  }

  const batchContext = resolvePostBookingEmailBatchContext(
    context as Record<string, unknown> | undefined,
  )

  await maybeTriggerPostBookingEmail({
    req,
    booking: doc as {
      id: number
      status?: string
      user?: unknown
      timeslot?: unknown
      tenant?: unknown
    },
    batchContext,
  })

  return doc
}

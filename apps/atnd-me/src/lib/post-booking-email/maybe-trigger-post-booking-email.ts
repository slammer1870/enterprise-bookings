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
import {
  findExistingLifetimeFirstBookingPostBookingEmailDelivery,
  findExistingPostBookingEmailDelivery,
  userHasPriorConfirmedBookingForTenant,
} from './delivery-queries'
import { resolveNextDay9am } from './resolve-send-time'
import { resolveEventTypePostBookingEmailsForBooking } from './resolve-event-type-post-booking-email'
import { loadTenantEmailFromGate } from '@/lib/resend/loadTenantEmailFromGate'
import { sendPostBookingEmail } from './send-post-booking-email'
import type { PostBookingEmailConfig } from './types'
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
    emailConfigId: string
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
      emailConfigId: data.emailConfigId,
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

async function maybeTriggerSinglePostBookingEmail({
  req,
  booking,
  batchContext,
  eventTypeId,
  timeslotId,
  tenantId,
  userId,
  user,
  config,
}: {
  req: PayloadRequest
  booking: { id: number; createdAt?: string | null }
  batchContext: ReturnType<typeof resolvePostBookingEmailBatchContext>
  eventTypeId: number
  timeslotId: number
  tenantId: number
  userId: number
  user: unknown
  config: PostBookingEmailConfig & {
    id: string
    sendTiming: PostBookingEmailSendTiming
  }
}): Promise<void> {
  const sendTiming = config.sendTiming
  if (!shouldTriggerPostBookingEmailForBatch(sendTiming, batchContext)) {
    return
  }

  // First-ever timings are once-ever per user/tenant.
  // Other timings remain idempotent per timeslot (and per checkout batch above).
  const isFirstEverTiming =
    sendTiming === 'after_first_booking' || sendTiming === 'next_day_after_first_booking'
  const existing = isFirstEverTiming
    ? await findExistingLifetimeFirstBookingPostBookingEmailDelivery(req, {
        tenantId,
        userId,
        sendTiming,
      })
    : await findExistingPostBookingEmailDelivery(req, {
        tenantId,
        userId,
        timeslotId,
        eventTypeId,
        emailConfigId: config.id,
      })
  if (existing) return

  if (isFirstEverTiming) {
    const bookingCreatedAt =
      typeof booking.createdAt === 'string' && booking.createdAt.length > 0
        ? booking.createdAt
        : null
    if (!bookingCreatedAt) {
      req.payload.logger.error(
        `[post-booking-email] Missing createdAt for booking ${booking.id}; skipping ${sendTiming}`,
      )
      return
    }

    const hasPriorBooking = await userHasPriorConfirmedBookingForTenant(req, {
      tenantId,
      userId,
      beforeCreatedAt: bookingCreatedAt,
    })
    if (hasPriorBooking) return
  }

  if (sendTiming === 'next_day_after_first_booking') {
    const timeslot = await req.payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id: timeslotId,
      depth: 1,
      overrideAccess: true,
    })
    const timeZone = resolveTimeslotTimeZone(timeslot as Parameters<typeof resolveTimeslotTimeZone>[0])
    const timeslotStartTime =
      timeslot && typeof timeslot === 'object' && 'startTime' in timeslot
        ? (timeslot as { startTime?: unknown }).startTime
        : null
    if (typeof timeslotStartTime !== 'string' && !(timeslotStartTime instanceof Date)) {
      req.payload.logger.error(
        `[post-booking-email] Missing timeslot startTime for timeslot ${timeslotId}; skipping next-day schedule`,
      )
      return
    }
    // 9am local on the calendar day after the booked class, not after checkout.
    // Normalize via Date so we persist UTC ISO (TZDate.toISOString may keep +01:00).
    const scheduledFor = new Date(
      resolveNextDay9am(timeslotStartTime, timeZone),
    ).toISOString()

    const delivery = await createDeliveryRecord(req, {
      tenantId,
      userId,
      timeslotId,
      eventTypeId,
      emailConfigId: config.id,
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
        emailConfigId: config.id,
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
    emailConfigId: config.id,
    sendTiming,
    status: 'scheduled',
    bookingId: booking.id,
  })

  scheduleOnNextEventLoop(() => {
    void (async () => {
      try {
        const tenantEmailFrom = await loadTenantEmailFromGate(req.payload, tenantId)
        await sendPostBookingEmail({
          payload: req.payload,
          user,
          config,
          tenantEmailFrom,
        })
      } catch (error) {
        req.payload.logger.error(
          `[post-booking-email] Failed to send delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        await req.payload
          .delete({
            collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
            id: delivery.id,
            overrideAccess: true,
          })
          .catch(() => undefined)
        return
      }

      let markedSent = false
      for (let attempt = 0; attempt < 3 && !markedSent; attempt += 1) {
        try {
          await req.payload.update({
            collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
            id: delivery.id,
            data: {
              status: 'sent',
              sentAt: new Date().toISOString(),
            },
            overrideAccess: true,
          })
          markedSent = true
        } catch (error) {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
            continue
          }
          // Email already sent — keep the delivery row so idempotency still works.
          req.payload.logger.error(
            `[post-booking-email] Sent email but failed to mark delivery ${delivery.id} as sent: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }
    })()
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
    createdAt?: string | null
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

  const resolved = await resolveEventTypePostBookingEmailsForBooking(req, booking)
  if (!resolved) return

  const user =
    booking.user && typeof booking.user === 'object'
      ? booking.user
      : await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          overrideAccess: true,
        })

  for (const config of resolved.configs) {
    await maybeTriggerSinglePostBookingEmail({
      req,
      booking,
      batchContext,
      eventTypeId: resolved.eventTypeId,
      timeslotId,
      tenantId,
      userId,
      user,
      config,
    })
  }
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
      createdAt?: string | null
      user?: unknown
      timeslot?: unknown
      tenant?: unknown
    },
    batchContext,
  })

  return doc
}

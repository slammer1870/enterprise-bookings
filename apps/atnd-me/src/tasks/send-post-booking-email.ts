import type { TaskHandler } from 'payload'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'
import { loadBookingTemplateContext } from '@/lib/post-booking-email/build-booking-template-context'
import { userHasPriorConfirmedBookingForTenant } from '@/lib/post-booking-email/delivery-queries'
import { sendPostBookingEmail } from '@/lib/post-booking-email/send-post-booking-email'
import type { PostBookingEmailConfig, PostBookingEmailJobInput } from '@/lib/post-booking-email/types'
import { resolvePostBookingEmailConfigById } from '@/lib/post-booking-email/types'
import { loadTenantEmailFromGate } from '@/lib/resend/loadTenantEmailFromGate'

export const sendPostBookingEmailTask: TaskHandler<'sendPostBookingEmail'> = async ({ input, req }) => {
  const jobInput = input as PostBookingEmailJobInput
  const { deliveryId, userId, bookingId, emailConfigId } = jobInput

  const delivery = await req.payload.findByID({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    id: deliveryId,
    depth: 0,
    overrideAccess: true,
  })

  if (!delivery || delivery.status !== 'scheduled') {
    return { output: { skipped: true, reason: 'delivery_not_scheduled' } }
  }

  if (bookingId != null) {
    const booking = await req.payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
      id: bookingId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)

    if (!booking || booking.status !== 'confirmed') {
      await req.payload.update({
        collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
        id: deliveryId,
        data: { status: 'cancelled' },
        overrideAccess: true,
        req,
      })
      return { output: { skipped: true, reason: 'booking_not_confirmed' } }
    }

    // Guard already-queued jobs for existing customers (booked this event type before).
    const bookingCreatedAt =
      typeof booking.createdAt === 'string' && booking.createdAt.length > 0
        ? booking.createdAt
        : null
    if (bookingCreatedAt) {
      const hasPriorBooking = await userHasPriorConfirmedBookingForTenant(req, {
        tenantId: jobInput.tenantId,
        userId,
        beforeCreatedAt: bookingCreatedAt,
      })
      if (hasPriorBooking) {
        await req.payload.update({
          collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
          id: deliveryId,
          data: { status: 'cancelled' },
          overrideAccess: true,
          req,
        })
        return { output: { skipped: true, reason: 'not_first_booking' } }
      }
    }
  }

  const eventType = await req.payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    id: jobInput.eventTypeId,
    depth: 0,
    overrideAccess: true,
  })

  const config = resolvePostBookingEmailConfigById(
    eventType as { postBookingEmails?: PostBookingEmailConfig[] | null },
    emailConfigId,
  )
  if (!config) {
    return { output: { skipped: true, reason: 'email_disabled' } }
  }

  const user = await req.payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })

  const [tenantEmailFrom, templateContext] = await Promise.all([
    loadTenantEmailFromGate(req.payload, jobInput.tenantId),
    bookingId != null
      ? loadBookingTemplateContext(req.payload, bookingId)
      : Promise.resolve(null),
  ])

  await sendPostBookingEmail({
    payload: req.payload,
    user,
    config,
    tenantId: jobInput.tenantId,
    tenantEmailFrom,
    templateContext,
  })

  await req.payload.update({
    collection: POST_BOOKING_EMAIL_DELIVERIES_SLUG,
    id: deliveryId,
    data: {
      status: 'sent',
      sentAt: new Date().toISOString(),
    },
    overrideAccess: true,
    req,
  })

  return { output: { sent: true } }
}

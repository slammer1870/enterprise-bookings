import type { TaskHandler } from 'payload'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { POST_BOOKING_EMAIL_DELIVERIES_SLUG } from '@/collections/PostBookingEmailDeliveries'
import { sendPostBookingEmail } from '@/lib/post-booking-email/send-post-booking-email'
import type { PostBookingEmailConfig, PostBookingEmailJobInput } from '@/lib/post-booking-email/types'
import { resolveActivePostBookingEmailConfig } from '@/lib/post-booking-email/types'

export const sendPostBookingEmailTask: TaskHandler<'sendPostBookingEmail'> = async ({ input, req }) => {
  const jobInput = input as PostBookingEmailJobInput
  const { deliveryId, userId, bookingId } = jobInput

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
  }

  const eventType = await req.payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    id: jobInput.eventTypeId,
    depth: 0,
    overrideAccess: true,
  })

  const config = resolveActivePostBookingEmailConfig(
    eventType as { postBookingEmails?: PostBookingEmailConfig[] | null },
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

  await sendPostBookingEmail({
    payload: req.payload,
    user,
    config,
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

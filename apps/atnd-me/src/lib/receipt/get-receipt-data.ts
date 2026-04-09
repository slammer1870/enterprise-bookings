'server-only'

import { getPlatformStripe } from '@/lib/stripe/platform'
import type { Payload } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export type ReceiptData = {
  timeslot?: {
    id: number
    className: string
    date: string
    startTime: string
    endTime: string
  }
  bookingCount: number
  amountPaidCents: number | null
  currency: string
  paymentMethod: 'stripe' | 'pay_at_door' | 'subscription'
}

/**
 * Fetch receipt data from a Stripe PaymentIntent (drop-in payment).
 * Verifies the payment belongs to the current user via transaction -> booking -> user.
 */
export async function getReceiptFromPaymentIntent(
  payload: Payload,
  paymentIntentId: string,
  userId: number
): Promise<ReceiptData | null> {
  const transactions = await payload.find({
    collection: 'transactions',
    where: {
      stripePaymentIntentId: { equals: paymentIntentId },
      paymentMethod: { equals: 'stripe' },
    },
    depth: 2,
    overrideAccess: true,
    select: { booking: true } as any,
  })

  if (transactions.docs.length === 0) return null

  const bookings: { id: number; user: number | { id: number }; timeslot: number | { id: number } }[] = []
  for (const tx of transactions.docs) {
    const b = tx.booking
    if (typeof b === 'object' && b !== null && 'id' in b) {
      const uid = typeof b.user === 'object' && b.user !== null && 'id' in b.user ? b.user.id : b.user
      if (Number(uid) === userId) {
        bookings.push(b as { id: number; user: number | { id: number }; timeslot: number | { id: number } })
      }
    }
  }
  const firstBooking = bookings[0]
  if (!firstBooking) return null

  const timeslotRef = firstBooking.timeslot
  const timeslotId = typeof timeslotRef === 'object' && timeslotRef !== null && 'id' in timeslotRef
    ? (timeslotRef as { id: number }).id
    : timeslotRef

  const timeslot = await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 1,
    overrideAccess: true,
    select: { id: true, startTime: true, endTime: true, date: true, eventType: true } as any,
  }) as { id: number; startTime: string; endTime: string; date: string; eventType?: { name?: string } } | null

  if (!timeslot) return null

  let amountPaidCents: number | null = null
  try {
    const stripe = getPlatformStripe()
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status === 'succeeded' && typeof pi.amount === 'number') {
      amountPaidCents = pi.amount
    }
    if (pi.currency) {
      // keep default eur
    }
  } catch {
    // Stripe fetch failed - receipt can still show booking info without amount
  }

  const eventType = timeslot.eventType as { name?: string } | undefined
  return {
    timeslot: {
      id: timeslot.id,
      className: eventType?.name ?? 'Class',
      date: timeslot.date,
      startTime: timeslot.startTime,
      endTime: timeslot.endTime,
    },
    bookingCount: bookings.length,
    amountPaidCents,
    currency: 'eur',
    paymentMethod: 'stripe',
  }
}

/**
 * Fetch receipt data from booking IDs (pay-at-door flow).
 */
export async function getReceiptFromBookingIds(
  payload: Payload,
  bookingIds: number[],
  userId: number
): Promise<ReceiptData | null> {
  if (bookingIds.length === 0) return null

  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      id: { in: bookingIds },
      user: { equals: userId },
      status: { equals: 'confirmed' },
    },
    depth: 2,
    limit: bookingIds.length,
    overrideAccess: true,
    select: { timeslot: true } as any,
  })

  if (bookings.docs.length === 0) return null

  const first = bookings.docs[0] as { timeslot: number | { id: number; startTime: string; endTime: string; date: string; eventType?: { name?: string } } }
  const timeslotRef = first.timeslot
  const timeslotId = typeof timeslotRef === 'object' && timeslotRef !== null && 'id' in timeslotRef
    ? (timeslotRef as { id: number }).id
    : timeslotRef

  const timeslot = await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 1,
    overrideAccess: true,
    select: { id: true, startTime: true, endTime: true, date: true, eventType: true } as any,
  }) as { id: number; startTime: string; endTime: string; date: string; eventType?: { name?: string } } | null

  if (!timeslot) return null

  const eventType = timeslot.eventType as { name?: string } | undefined
  return {
    timeslot: {
      id: timeslot.id,
      className: eventType?.name ?? 'Class',
      date: timeslot.date,
      startTime: timeslot.startTime,
      endTime: timeslot.endTime,
    },
    bookingCount: bookings.docs.length,
    amountPaidCents: null,
    currency: 'eur',
    paymentMethod: 'pay_at_door',
  }
}

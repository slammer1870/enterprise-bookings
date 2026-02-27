'server-only'

import { getPlatformStripe } from '@/lib/stripe/platform'
import type { Payload } from 'payload'

export type ReceiptData = {
  lesson?: {
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
  })

  if (transactions.docs.length === 0) return null

  const bookings: { id: number; user: number | { id: number }; lesson: number | { id: number } }[] = []
  for (const tx of transactions.docs) {
    const b = tx.booking
    if (typeof b === 'object' && b !== null && 'id' in b) {
      const uid = typeof b.user === 'object' && b.user !== null && 'id' in b.user ? b.user.id : b.user
      if (Number(uid) === userId) {
        bookings.push(b as { id: number; user: number | { id: number }; lesson: number | { id: number } })
      }
    }
  }
  const firstBooking = bookings[0]
  if (!firstBooking) return null

  const lessonRef = firstBooking.lesson
  const lessonId = typeof lessonRef === 'object' && lessonRef !== null && 'id' in lessonRef
    ? (lessonRef as { id: number }).id
    : lessonRef

  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
    overrideAccess: true,
  }) as { id: number; startTime: string; endTime: string; date: string; classOption?: { name?: string } } | null

  if (!lesson) return null

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

  const classOption = lesson.classOption as { name?: string } | undefined
  return {
    lesson: {
      id: lesson.id,
      className: classOption?.name ?? 'Class',
      date: lesson.date,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
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
  })

  if (bookings.docs.length === 0) return null

  const first = bookings.docs[0] as { lesson: number | { id: number; startTime: string; endTime: string; date: string; classOption?: { name?: string } } }
  const lessonRef = first.lesson
  const lessonId = typeof lessonRef === 'object' && lessonRef !== null && 'id' in lessonRef
    ? (lessonRef as { id: number }).id
    : lessonRef

  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
    overrideAccess: true,
  }) as { id: number; startTime: string; endTime: string; date: string; classOption?: { name?: string } } | null

  if (!lesson) return null

  const classOption = lesson.classOption as { name?: string } | undefined
  return {
    lesson: {
      id: lesson.id,
      className: classOption?.name ?? 'Class',
      date: lesson.date,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
    },
    bookingCount: bookings.docs.length,
    amountPaidCents: null,
    currency: 'eur',
    paymentMethod: 'pay_at_door',
  }
}

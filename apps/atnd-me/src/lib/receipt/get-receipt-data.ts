'server-only'

import { getPlatformStripe } from '@/lib/stripe/platform'
import { parseBookingIds } from '@/lib/stripe-connect/webhook/parse-metadata'
import { resolveTimeZone, resolveTimeslotTimeZone } from '@repo/shared-utils/timezone'
import type { Payload } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export type ReceiptPaymentMethod = 'stripe' | 'pay_at_door' | 'subscription' | 'class_pass'

export type ReceiptData = {
  timeslot?: {
    id: number
    className: string
    date: string
    startTime: string
    endTime: string
  }
  timeZone: string
  bookingCount: number
  amountPaidCents: number | null
  currency: string
  paymentMethod: ReceiptPaymentMethod
}

type EventTypePaymentMethods = {
  allowedDropIn?: unknown
  allowedPlans?: unknown[]
  allowedClassPasses?: unknown[]
}

function hasConfiguredPaymentMethods(paymentMethods?: EventTypePaymentMethods | null): boolean {
  if (!paymentMethods || typeof paymentMethods !== 'object') return false
  const allowedDropIn = paymentMethods.allowedDropIn
  const hasDropIn =
    allowedDropIn != null &&
    (typeof allowedDropIn === 'number' ||
      (typeof allowedDropIn === 'string' && allowedDropIn !== '') ||
      (typeof allowedDropIn === 'object' && allowedDropIn !== null))
  const hasPlans =
    Array.isArray(paymentMethods.allowedPlans) && paymentMethods.allowedPlans.length > 0
  const hasClassPasses =
    Array.isArray(paymentMethods.allowedClassPasses) &&
    paymentMethods.allowedClassPasses.length > 0
  return hasDropIn || hasPlans || hasClassPasses
}

function getPlatformDefaultTimeZone(payload: Payload): string {
  const configured = payload.config?.admin?.timezones?.defaultTimezone
  return resolveTimeZone(typeof configured === 'string' ? configured : null)
}

async function fetchStripeAmount(
  paymentIntentId: string,
  stripeAccountId?: string | null,
): Promise<{ amountPaidCents: number | null; currency: string }> {
  try {
    const stripe = getPlatformStripe()
    let pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
    if (!pi && stripeAccountId) {
      pi = await stripe.paymentIntents
        .retrieve(paymentIntentId, { stripeAccount: stripeAccountId })
        .catch(() => null)
    }
    if (!pi) return { amountPaidCents: null, currency: 'eur' }

    const amountPaidCents =
      pi.status === 'succeeded' && typeof pi.amount === 'number' ? pi.amount : null
    return { amountPaidCents, currency: pi.currency ?? 'eur' }
  } catch {
    return { amountPaidCents: null, currency: 'eur' }
  }
}

async function retrieveSucceededPaymentIntent(
  paymentIntentId: string,
  stripeAccountId?: string | null,
) {
  const stripe = getPlatformStripe()

  let pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
  if (!pi && stripeAccountId) {
    pi = await stripe.paymentIntents
      .retrieve(paymentIntentId, { stripeAccount: stripeAccountId })
      .catch(() => null)
  }

  return pi?.status === 'succeeded' ? pi : null
}

async function resolvePaymentFromBookings(
  payload: Payload,
  bookingIds: number[],
  eventTypePaymentMethods?: EventTypePaymentMethods | null,
): Promise<Pick<ReceiptData, 'paymentMethod' | 'amountPaidCents' | 'currency'>> {
  const transactions = await payload.find({
    collection: 'transactions',
    where: { booking: { in: bookingIds } },
    depth: 0,
    limit: bookingIds.length,
    overrideAccess: true,
    select: {
      paymentMethod: true,
      stripePaymentIntentId: true,
    } as any,
  })

  const tx = transactions.docs[0] as
    | { paymentMethod?: string; stripePaymentIntentId?: string | null }
    | undefined

  if (tx?.paymentMethod === 'stripe') {
    if (tx.stripePaymentIntentId) {
      const { amountPaidCents, currency } = await fetchStripeAmount(tx.stripePaymentIntentId)
      return { paymentMethod: 'stripe', amountPaidCents, currency }
    }
    return { paymentMethod: 'stripe', amountPaidCents: null, currency: 'eur' }
  }

  if (tx?.paymentMethod === 'subscription') {
    return { paymentMethod: 'subscription', amountPaidCents: null, currency: 'eur' }
  }

  if (tx?.paymentMethod === 'class_pass') {
    return { paymentMethod: 'class_pass', amountPaidCents: null, currency: 'eur' }
  }

  const bookings = await payload.find({
    collection: 'bookings',
    where: { id: { in: bookingIds } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    select: { paymentMethodUsed: true } as any,
  })

  const paymentMethodUsed = (bookings.docs[0] as { paymentMethodUsed?: string } | undefined)
    ?.paymentMethodUsed

  if (paymentMethodUsed === 'stripe') {
    return { paymentMethod: 'stripe', amountPaidCents: null, currency: 'eur' }
  }
  if (paymentMethodUsed === 'class_pass') {
    return { paymentMethod: 'class_pass', amountPaidCents: null, currency: 'eur' }
  }
  if (paymentMethodUsed === 'subscription') {
    return { paymentMethod: 'subscription', amountPaidCents: null, currency: 'eur' }
  }

  if (hasConfiguredPaymentMethods(eventTypePaymentMethods)) {
    return { paymentMethod: 'stripe', amountPaidCents: 0, currency: 'eur' }
  }

  return { paymentMethod: 'pay_at_door', amountPaidCents: null, currency: 'eur' }
}

async function loadTimeslotReceipt(
  payload: Payload,
  timeslotId: number,
): Promise<{
  timeslot: ReceiptData['timeslot']
  timeZone: string
  eventTypePaymentMethods?: EventTypePaymentMethods | null
} | null> {
  const platformDefaultTimeZone = getPlatformDefaultTimeZone(payload)

  const timeslot = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 1,
    overrideAccess: true,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      date: true,
      timeZone: true,
      tenant: true,
      eventType: true,
    } as any,
  })) as {
    id: number
    startTime: string
    endTime: string
    date: string
    timeZone?: string | null
    tenant?: { timeZone?: string | null } | number | null
    eventType?: { name?: string; paymentMethods?: EventTypePaymentMethods }
  } | null

  if (!timeslot) return null

  const eventType = timeslot.eventType
  const timeZone = resolveTimeslotTimeZone(
    { timeZone: timeslot.timeZone, tenant: timeslot.tenant },
    platformDefaultTimeZone,
  )

  return {
    timeslot: {
      id: timeslot.id,
      className: eventType?.name ?? 'Class',
      date: timeslot.date,
      startTime: timeslot.startTime,
      endTime: timeslot.endTime,
    },
    timeZone,
    eventTypePaymentMethods: eventType?.paymentMethods ?? null,
  }
}

type ReceiptOverrides = Partial<Pick<ReceiptData, 'paymentMethod' | 'amountPaidCents' | 'currency'>>

/**
 * Fetch receipt data from a Stripe PaymentIntent (drop-in payment).
 * Verifies the payment belongs to the current user via transaction -> booking -> user.
 */
export async function getReceiptFromPaymentIntent(
  payload: Payload,
  paymentIntentId: string,
  userId: number,
  opts?: { stripeAccountId?: string | null },
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

  const bookings: {
    id: number
    user: number | { id: number }
    timeslot: number | { id: number }
  }[] = []

  for (const tx of transactions.docs) {
    const b = tx.booking
    if (typeof b === 'object' && b !== null && 'id' in b) {
      const uid =
        typeof b.user === 'object' && b.user !== null && 'id' in b.user ? b.user.id : b.user
      if (Number(uid) === userId) {
        bookings.push(
          b as { id: number; user: number | { id: number }; timeslot: number | { id: number } },
        )
      }
    }
  }

  if (bookings.length === 0) {
    const pi = await retrieveSucceededPaymentIntent(
      paymentIntentId,
      opts?.stripeAccountId ?? null,
    )
    if (!pi) return null

    const metadataBookingIds = parseBookingIds(pi.metadata ?? {})
    if (metadataBookingIds.length > 0) {
      return getReceiptFromBookingIds(payload, metadataBookingIds, userId, {
        paymentMethod: 'stripe',
        amountPaidCents: typeof pi.amount === 'number' ? pi.amount : null,
        currency: pi.currency ?? 'eur',
      })
    }

    const metaUserId = pi.metadata?.userId ? parseInt(pi.metadata.userId, 10) : NaN
    const metaTimeslotId = pi.metadata?.timeslotId
      ? parseInt(pi.metadata.timeslotId, 10)
      : pi.metadata?.lessonId
        ? parseInt(pi.metadata.lessonId, 10)
        : NaN

    if (!Number.isNaN(metaUserId) && metaUserId === userId && !Number.isNaN(metaTimeslotId)) {
      const recentBookings = await payload.find({
        collection: 'bookings',
        where: {
          user: { equals: userId },
          timeslot: { equals: metaTimeslotId },
          status: { equals: 'confirmed' },
        },
        depth: 0,
        sort: '-createdAt',
        limit: 10,
        overrideAccess: true,
        select: { id: true } as any,
      })

      const ids = recentBookings.docs
        .map((doc) => (doc as { id?: number }).id)
        .filter((id): id is number => typeof id === 'number')

      if (ids.length > 0) {
        return getReceiptFromBookingIds(payload, ids, userId, {
          paymentMethod: 'stripe',
          amountPaidCents: typeof pi.amount === 'number' ? pi.amount : null,
          currency: pi.currency ?? 'eur',
        })
      }
    }

    return null
  }

  const firstBooking = bookings[0]
  if (!firstBooking) return null

  const timeslotRef = firstBooking.timeslot
  const timeslotId =
    typeof timeslotRef === 'object' && timeslotRef !== null && 'id' in timeslotRef
      ? (timeslotRef as { id: number }).id
      : timeslotRef

  const loaded = await loadTimeslotReceipt(payload, timeslotId)
  if (!loaded?.timeslot) return null

  const { amountPaidCents, currency } = await fetchStripeAmount(
    paymentIntentId,
    opts?.stripeAccountId ?? null,
  )

  return {
    timeslot: loaded.timeslot,
    timeZone: loaded.timeZone,
    bookingCount: bookings.length,
    amountPaidCents,
    currency,
    paymentMethod: 'stripe',
  }
}

/**
 * Fetch receipt data from booking IDs (pay-at-door, promo/zero-amount checkout, class pass, etc.).
 */
export async function getReceiptFromBookingIds(
  payload: Payload,
  bookingIds: number[],
  userId: number,
  overrides?: ReceiptOverrides,
): Promise<ReceiptData | null> {
  if (bookingIds.length === 0) return null

  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      id: { in: bookingIds },
      user: { equals: userId },
      status: { equals: 'confirmed' },
    },
    depth: 0,
    limit: bookingIds.length,
    overrideAccess: true,
    select: { timeslot: true } as any,
  })

  if (bookings.docs.length === 0) return null

  const first = bookings.docs[0] as { timeslot: number | { id: number } }
  const timeslotRef = first.timeslot
  const timeslotId =
    typeof timeslotRef === 'object' && timeslotRef !== null && 'id' in timeslotRef
      ? (timeslotRef as { id: number }).id
      : timeslotRef

  const loaded = await loadTimeslotReceipt(payload, timeslotId)
  if (!loaded?.timeslot) return null

  const resolved =
    overrides ??
    (await resolvePaymentFromBookings(
      payload,
      bookingIds,
      loaded.eventTypePaymentMethods ?? null,
    ))

  return {
    timeslot: loaded.timeslot,
    timeZone: loaded.timeZone,
    bookingCount: bookings.docs.length,
    amountPaidCents: resolved.amountPaidCents ?? null,
    currency: resolved.currency ?? 'eur',
    paymentMethod: resolved.paymentMethod ?? 'pay_at_door',
  }
}

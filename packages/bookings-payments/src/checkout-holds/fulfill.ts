import type { CollectionSlug } from 'payload'
import {
  BOOKINGS_COLLECTION_SLUG,
  CHECKOUT_HOLD_COLLECTION_SLUG,
  TRANSACTIONS_COLLECTION_SLUG,
} from './constants'
import {
  computeRemainingCapacityWithHolds,
  isHoldActive,
  isHoldWithinFulfillmentGrace,
  type CheckoutHoldRecord,
} from './service'

type PayloadLike = any

export type FulfillCheckoutHoldResult = {
  confirmedBookingIds: number[]
  refunded: boolean
  failureReason?: string
}

function relationId(value: number | { id: number } | null | undefined): number | null {
  if (value == null) return null
  return typeof value === 'object' ? value.id : value
}

async function markHoldExpired(
  payload: PayloadLike,
  holdId: number,
  failureReason: string,
  holdCollection: CollectionSlug,
) {
  await payload.update({
    collection: holdCollection,
    id: holdId,
    data: { status: 'expired', failureReason },
    overrideAccess: true,
  })
}

export async function fulfillCheckoutHold(
  payload: PayloadLike,
  opts: {
    holdId: number
    userId: number
    paymentIntentId?: string
    tenantId: number
    holdCollection?: CollectionSlug
    bookingsSlug?: CollectionSlug
    transactionsSlug?: CollectionSlug
    timeslotsSlug?: CollectionSlug
    eventTypesSlug?: CollectionSlug
    refundPaymentIntent?: (_paymentIntentId: string) => Promise<void>
    tenantContext?: { tenant?: number } | null
  },
): Promise<FulfillCheckoutHoldResult> {
  const holdCollection = opts.holdCollection ?? CHECKOUT_HOLD_COLLECTION_SLUG
  const bookingsSlug = opts.bookingsSlug ?? BOOKINGS_COLLECTION_SLUG
  const transactionsSlug = opts.transactionsSlug ?? TRANSACTIONS_COLLECTION_SLUG
  const tenantContext = opts.tenantContext ?? { tenant: opts.tenantId }

  const hold = (await payload.findByID({
    collection: holdCollection,
    id: opts.holdId,
    depth: 0,
    overrideAccess: true,
  })) as CheckoutHoldRecord | null

  if (!hold) {
    throw new Error(`Checkout hold ${opts.holdId} not found.`)
  }

  if (hold.status === 'consumed') {
    return { confirmedBookingIds: [], refunded: false }
  }

  const holdUserId = relationId(hold.user)
  if (holdUserId !== opts.userId) {
    throw new Error('Checkout hold does not belong to this user.')
  }

  const nowMs = Date.now()
  const active = isHoldActive(hold, nowMs)
  const withinGrace = !active && isHoldWithinFulfillmentGrace(hold, nowMs)

  if (!active && !withinGrace) {
    if (opts.paymentIntentId && opts.refundPaymentIntent) {
      await opts.refundPaymentIntent(opts.paymentIntentId)
    }
    await markHoldExpired(payload, hold.id, 'past_grace', holdCollection)
    return { confirmedBookingIds: [], refunded: true, failureReason: 'past_grace' }
  }

  const timeslotId = relationId(hold.timeslot)
  if (timeslotId == null) {
    throw new Error('Checkout hold is missing timeslot.')
  }

  const remaining = await computeRemainingCapacityWithHolds(payload, timeslotId, {
    timeslotsSlug: opts.timeslotsSlug,
    eventTypesSlug: opts.eventTypesSlug,
    bookingsSlug,
    holdCollection,
  })

  // Active hold quantity is already counted in remaining; for grace path expired hold is not counted.
  const capacityForFulfillment = active ? remaining + hold.quantity : remaining

  if (capacityForFulfillment < hold.quantity) {
    if (opts.paymentIntentId && opts.refundPaymentIntent) {
      await opts.refundPaymentIntent(opts.paymentIntentId)
    }
    await markHoldExpired(payload, hold.id, 'capacity_taken_during_grace', holdCollection)
    return {
      confirmedBookingIds: [],
      refunded: true,
      failureReason: 'capacity_taken_during_grace',
    }
  }

  const confirmedBookingIds: number[] = []

  for (let i = 0; i < hold.quantity; i++) {
    const created = (await payload.create({
      collection: bookingsSlug,
      data: {
        timeslot: timeslotId,
        user: opts.userId,
        tenant: opts.tenantId,
        status: 'confirmed',
      },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
    })) as { id: number }

    confirmedBookingIds.push(created.id)

    if (opts.paymentIntentId) {
      await payload.create({
        collection: transactionsSlug,
        data: {
          booking: created.id,
          paymentMethod: 'stripe',
          stripePaymentIntentId: opts.paymentIntentId,
          tenant: opts.tenantId,
        },
        ...(tenantContext ? { context: tenantContext } : {}),
        overrideAccess: true,
      })
    }
  }

  await payload.update({
    collection: holdCollection,
    id: hold.id,
    data: {
      status: 'consumed',
      ...(opts.paymentIntentId ? { stripePaymentIntentId: opts.paymentIntentId } : {}),
    },
    overrideAccess: true,
  })

  return { confirmedBookingIds, refunded: false }
}

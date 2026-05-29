import type { CollectionSlug } from 'payload'
import {
  BOOKINGS_COLLECTION_SLUG,
  CHECKOUT_HOLD_COLLECTION_SLUG,
  TRANSACTIONS_COLLECTION_SLUG,
} from './constants'
import {
  computeRemainingCapacityWithHolds,
  isHoldActive,
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
    // The hold was already fulfilled (e.g. webhook re-delivery after a partial failure).
    // Try to find bookings already created via this payment so the caller gets the right IDs.
    if (opts.paymentIntentId) {
      const existingTxns = (await payload.find({
        collection: opts.transactionsSlug ?? TRANSACTIONS_COLLECTION_SLUG,
        where: { stripePaymentIntentId: { equals: opts.paymentIntentId } },
        depth: 0,
        limit: 100,
        overrideAccess: true,
      }).catch(() => ({ docs: [] }))) as { docs: Array<{ booking?: number | { id: number } }> }
      const ids = existingTxns.docs
        .map((t) => (typeof t.booking === 'object' ? t.booking?.id : t.booking))
        .filter((id): id is number => typeof id === 'number')
      return { confirmedBookingIds: ids, refunded: false }
    }
    return { confirmedBookingIds: [], refunded: false }
  }

  const holdUserId = relationId(hold.user)
  if (holdUserId !== opts.userId) {
    throw new Error('Checkout hold does not belong to this user.')
  }

  const nowMs = Date.now()
  const active = isHoldActive(hold, nowMs)

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

  // Active hold quantity is already counted in remaining (it reduces available spots).
  // Expired hold is not counted, so no adjustment needed.
  const capacityForFulfillment = active ? remaining + hold.quantity : remaining

  if (capacityForFulfillment < hold.quantity) {
    if (opts.paymentIntentId && opts.refundPaymentIntent) {
      await opts.refundPaymentIntent(opts.paymentIntentId)
    }
    await markHoldExpired(payload, hold.id, 'capacity_taken', holdCollection)
    return {
      confirmedBookingIds: [],
      refunded: true,
      failureReason: 'capacity_taken',
    }
  }

  // Mark the hold consumed BEFORE creating bookings.
  //
  // Why: booking creation triggers expensive afterChange hooks (lockout sync, waitlist check),
  // so the loop can take 1–4 seconds for multi-booking scenarios.  During that window the old
  // ordering (bookings first, hold consumed last) caused `remainingCapacity` to double-count:
  // both the new confirmed bookings AND the still-active hold were subtracted, making capacity
  // appear lower than correct for several seconds.
  //
  // Marking consumed first means the hold is removed from the "active holds" tally immediately,
  // so capacity stays stable while bookings are being written.
  //
  // Re-delivery safety: if booking creation fails partway through, a Stripe re-delivery will
  // find `hold.status === 'consumed'` above and look up already-created transactions to return
  // the correct booking IDs rather than creating duplicates.
  await payload.update({
    collection: holdCollection,
    id: hold.id,
    data: {
      status: 'consumed',
      ...(opts.paymentIntentId ? { stripePaymentIntentId: opts.paymentIntentId } : {}),
    },
    overrideAccess: true,
  })

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

  return { confirmedBookingIds, refunded: false }
}

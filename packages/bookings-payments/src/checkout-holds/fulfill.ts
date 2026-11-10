import type { CollectionSlug } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import {
  BOOKINGS_COLLECTION_SLUG,
  CHECKOUT_HOLD_COLLECTION_SLUG,
  TIMESLOTS_COLLECTION_SLUG,
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

/** Split a total cent amount across `n` bookings without losing remainder cents. */
export function splitCents(totalCents: number, n: number): number[] {
  const count = Math.max(0, Math.trunc(n))
  if (count === 0) return []
  const total = Number.isFinite(totalCents) ? Math.max(0, Math.round(totalCents)) : 0
  const base = Math.floor(total / count)
  const remainder = total - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
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
    /** Drop-in product id for once-per-user tracking (stripe/drop-in checkouts). */
    dropInId?: number | null
    /**
     * Total class price for this hold in cents, excluding the platform booking fee.
     * Gift-voucher value redeemed on the class is included. Other promo discounts are not.
     * Split across the hold quantity.
     */
    classPriceAmountCents?: number
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
    return {
      confirmedBookingIds: await bookingIdsForPaymentIntent(payload, opts),
      refunded: false,
    }
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
  // The claim is conditional (`status <> consumed`) so the success page and the webhook can
  // both try to fulfill the same payment without creating two bookings.
  const claimed = await claimHoldForFulfillment(payload, holdCollection, hold.id, opts.paymentIntentId)
  if (!claimed) {
    return {
      confirmedBookingIds: await bookingIdsForPaymentIntent(payload, opts),
      refunded: false,
    }
  }

  const confirmedBookingIds: number[] = []

  const dropInId =
    typeof opts.dropInId === 'number' && Number.isFinite(opts.dropInId) && opts.dropInId > 0
      ? opts.dropInId
      : null

  const amountCentsPerBooking =
    opts.classPriceAmountCents != null && Number.isFinite(opts.classPriceAmountCents)
      ? splitCents(opts.classPriceAmountCents, hold.quantity)
      : null

  const timeslotsSlug = opts.timeslotsSlug ?? TIMESLOTS_COLLECTION_SLUG
  const timeslot = (await payload.findByID({
    collection: timeslotsSlug,
    id: timeslotId,
    depth: 0,
    overrideAccess: true,
  })) as { branch?: number | { id: number } | null } | null
  const branchId = relationId(timeslot?.branch)

  for (let i = 0; i < hold.quantity; i++) {
    const created = (await payload.create({
      collection: bookingsSlug,
      data: {
        timeslot: timeslotId,
        user: opts.userId,
        tenant: opts.tenantId,
        status: 'confirmed',
        paymentMethodUsed: 'stripe',
      },
      context: {
        ...(tenantContext ?? {}),
        postBookingEmailBatch: {
          batchSize: hold.quantity,
          batchIndex: i,
        },
      },
      overrideAccess: true,
    })) as { id: number }

    confirmedBookingIds.push(created.id)

    await payload.create({
      collection: transactionsSlug,
      data: {
        booking: created.id,
        paymentMethod: 'stripe',
        ...(opts.paymentIntentId ? { stripePaymentIntentId: opts.paymentIntentId } : {}),
        ...(dropInId != null ? { dropInId } : {}),
        ...(amountCentsPerBooking != null ? { amountCents: amountCentsPerBooking[i] } : {}),
        ...(branchId != null ? { branch: branchId } : {}),
        tenant: opts.tenantId,
      },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
    })
  }

  return { confirmedBookingIds, refunded: false }
}

async function bookingIdsForPaymentIntent(
  payload: PayloadLike,
  opts: { paymentIntentId?: string; transactionsSlug?: CollectionSlug },
): Promise<number[]> {
  if (!opts.paymentIntentId) return []
  const existingTxns = (await payload
    .find({
      collection: opts.transactionsSlug ?? TRANSACTIONS_COLLECTION_SLUG,
      where: { stripePaymentIntentId: { equals: opts.paymentIntentId } },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] }))) as { docs: Array<{ booking?: number | { id: number } }> }
  return existingTxns.docs
    .map((t) => (typeof t.booking === 'object' ? t.booking?.id : t.booking))
    .filter((id): id is number => typeof id === 'number')
}

type DrizzleExecute = {
  execute: (
    _query: unknown,
  ) => Promise<{ rows?: Array<{ id?: number }> } | Array<{ id?: number }>>
}

function drizzleExecutor(payload: PayloadLike): DrizzleExecute | null {
  const drizzle = payload?.db?.drizzle as DrizzleExecute | undefined
  if (!drizzle || typeof drizzle.execute !== 'function') return null
  return drizzle
}

/**
 * Atomically move the hold to `consumed`. Returns false when another worker
 * already claimed it. Falls back to a plain update when drizzle isn't available
 * (unit tests).
 */
async function claimHoldForFulfillment(
  payload: PayloadLike,
  holdCollection: CollectionSlug,
  holdId: number,
  paymentIntentId?: string,
): Promise<boolean> {
  const drizzle = drizzleExecutor(payload)
  if (drizzle) {
    const paymentIntent = paymentIntentId ?? null
    const result = await drizzle.execute(sql`
      UPDATE "booking_checkout_holds"
      SET
        "status" = 'consumed',
        "stripe_payment_intent_id" = COALESCE(${paymentIntent}, "stripe_payment_intent_id"),
        "updated_at" = NOW()
      WHERE "id" = ${holdId}
        AND "status" <> 'consumed'
      RETURNING "id"
    `)
    const rows = Array.isArray(result) ? result : (result.rows ?? [])
    return rows.length > 0
  }

  await payload.update({
    collection: holdCollection,
    id: holdId,
    data: {
      status: 'consumed',
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    overrideAccess: true,
  })
  return true
}

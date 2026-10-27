import 'server-only'

import type { Payload } from 'payload'
import type Stripe from 'stripe'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { classBranchLedgerCentsForCode } from '@/lib/stripe-connect/classBranchLedgerCents'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { fulfillCheckoutHold } from '@repo/bookings-payments'

const CONFIRM_WAIT_MS = 8_000
const CONFIRM_POLL_MS = 250

function parsePositiveInt(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function classPriceCentsFromPaymentIntent(pi: Stripe.PaymentIntent): number | undefined {
  const fromMeta = parsePositiveInt(pi.metadata?.classPriceAmountCents)
  if (fromMeta != null) return fromMeta
  if (typeof pi.amount !== 'number' || !Number.isFinite(pi.amount)) return undefined
  const fee = typeof pi.application_fee_amount === 'number' ? pi.application_fee_amount : 0
  return Math.max(0, Math.round(pi.amount - fee))
}

async function retrievePaymentIntent(
  paymentIntentId: string,
  stripeAccountId?: string | null,
): Promise<Stripe.PaymentIntent | null> {
  const stripe = getPlatformStripe()
  let pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null)
  if (!pi && stripeAccountId) {
    pi = await stripe.paymentIntents
      .retrieve(paymentIntentId, { stripeAccount: stripeAccountId })
      .catch(() => null)
  }
  return pi
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Null means "try again". A brief Stripe or database miss must not skip fulfillment. */
async function pollUntil<T>(read: () => Promise<T | null | 'stop'>): Promise<T | null> {
  const deadline = Date.now() + CONFIRM_WAIT_MS
  while (Date.now() < deadline) {
    const value = await read()
    if (value === 'stop') return null
    if (value != null) return value
    const remaining = deadline - Date.now()
    if (remaining <= 0) return null
    await sleep(Math.min(CONFIRM_POLL_MS, remaining))
  }
  return null
}

async function waitUntilSucceeded(
  paymentIntentId: string,
  stripeAccountId?: string | null,
): Promise<Stripe.PaymentIntent | null> {
  return pollUntil(async () => {
    const pi = await retrievePaymentIntent(paymentIntentId, stripeAccountId)
    if (pi?.status === 'succeeded') return pi
    if (pi && (pi.status === 'canceled' || pi.status === 'requires_payment_method')) return 'stop'
    return null
  })
}

async function waitForConfirmedBooking(
  payload: Payload,
  timeslotId: number,
  userId: number,
): Promise<boolean> {
  const found = await pollUntil(async () => {
    const result = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { timeslot: { equals: timeslotId } },
          { user: { equals: userId } },
          { status: { equals: 'confirmed' } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    return result.docs.length > 0 ? true : null
  })
  return found === true
}

/**
 * Create the confirmed drop-in booking before the customer can open the schedule.
 * Cards can return while the PaymentIntent is still `processing`. This waits until
 * it has succeeded, then writes the booking. The webhook remains the other writer
 * and still redeems discount codes. Returns true only when a confirmed booking exists.
 */
export async function confirmDropInPaymentOnReturn(opts: {
  payload: Payload
  userId: number
  paymentIntentId: string
  tenantId: number
  stripeAccountId?: string | null
}): Promise<boolean> {
  const pi = await waitUntilSucceeded(opts.paymentIntentId, opts.stripeAccountId)
  if (!pi) return false

  const metaUserId = parsePositiveInt(pi.metadata?.userId)
  if (metaUserId == null || metaUserId !== opts.userId) return false

  const holdId = parsePositiveInt(pi.metadata?.holdId)
  if (holdId == null) return false

  const timeslotId =
    parsePositiveInt(pi.metadata?.timeslotId) ?? parsePositiveInt(pi.metadata?.lessonId)
  const dropInId = parsePositiveInt(pi.metadata?.dropInId)
  const classPriceBeforeDiscount = Number(pi.metadata?.classPriceBeforeDiscount)
  const cashCents = classPriceCentsFromPaymentIntent(pi)
  const ledgerCents =
    cashCents == null
      ? undefined
      : await classBranchLedgerCentsForCode({
          payload: opts.payload,
          tenantId: opts.tenantId,
          discountCode: typeof pi.metadata?.discountCode === 'string' ? pi.metadata.discountCode : null,
          cashCents,
          classPriceBeforeDiscountEuros: Number.isFinite(classPriceBeforeDiscount)
            ? classPriceBeforeDiscount
            : null,
        })

  const stripeAccountId = opts.stripeAccountId
  const result = await fulfillCheckoutHold(opts.payload, {
    holdId,
    userId: opts.userId,
    paymentIntentId: pi.id,
    dropInId,
    classPriceAmountCents: ledgerCents,
    tenantId: opts.tenantId,
    tenantContext: { tenant: opts.tenantId },
    timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    refundPaymentIntent: async (paymentIntentId: string) => {
      const stripe = getPlatformStripe()
      if (stripeAccountId) {
        await stripe.refunds.create(
          { payment_intent: paymentIntentId },
          { stripeAccount: stripeAccountId },
        )
      } else {
        await stripe.refunds.create({ payment_intent: paymentIntentId })
      }
    },
  })

  if (result.refunded) return false
  if (result.confirmedBookingIds.length > 0) return true
  if (timeslotId == null) return false
  return waitForConfirmedBooking(opts.payload, timeslotId, opts.userId)
}

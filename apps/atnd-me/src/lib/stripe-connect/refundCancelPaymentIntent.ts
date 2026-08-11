import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { computePartialRefundAmountCents } from '@repo/bookings-payments'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

async function retrievePaymentIntent(
  paymentIntentId: string,
  stripeAccountId?: string | null,
): Promise<{ pi: Stripe.PaymentIntent; useConnect: boolean } | null> {
  if (!stripe) return null

  if (stripeAccountId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        stripeAccount: stripeAccountId,
      })
      return { pi, useConnect: true }
    } catch {
      // Fall through to platform retrieve (destination charges).
    }
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    return { pi, useConnect: false }
  } catch {
    return null
  }
}

/**
 * Refund a drop-in PaymentIntent for a cancelled booking (Connect-aware, partial-safe).
 */
export async function refundCancelPaymentIntent(args: {
  paymentIntentId: string
  amountCents: number
  siblingCount: number
  alreadyRefundedCount: number
  stripeAccountId?: string | null
}): Promise<{ refundId?: string | null }> {
  const {
    paymentIntentId,
    amountCents,
    siblingCount,
    alreadyRefundedCount,
    stripeAccountId,
  } = args

  if (!stripe) {
    return { refundId: null }
  }

  if (stripeAccountId && isStripeTestAccount(stripeAccountId)) {
    return { refundId: `re_test_${Date.now()}` }
  }

  const retrieved = await retrievePaymentIntent(paymentIntentId, stripeAccountId)
  const pi = retrieved?.pi
  const useConnect = Boolean(retrieved?.useConnect && stripeAccountId)

  const piAmount =
    typeof pi?.amount_received === 'number' && pi.amount_received > 0
      ? pi.amount_received
      : typeof pi?.amount === 'number'
        ? pi.amount
        : 0

  const refundAmount =
    amountCents > 0
      ? amountCents
      : computePartialRefundAmountCents({
          paymentIntentAmountCents: piAmount,
          siblingCount,
          alreadyRefundedCount,
        })

  if (refundAmount <= 0) {
    return { refundId: null }
  }

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
    amount: refundAmount,
  }

  const refund = useConnect
    ? await stripe.refunds.create(refundParams, { stripeAccount: stripeAccountId! })
    : await stripe.refunds.create(refundParams)

  return { refundId: refund.id }
}

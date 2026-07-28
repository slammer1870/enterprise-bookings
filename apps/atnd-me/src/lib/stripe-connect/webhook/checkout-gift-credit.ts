/**
 * Checkout gift-credit leftovers after Stripe applies a one-time amount_off promo.
 * Class pass → remainder discount code; subscription → customer balance credit.
 *
 * Promo may arrive as metadata.discountCode (app Apply) or only as a Stripe
 * promotion_code on the Checkout Session / Subscription (allow_promotion_codes box).
 */
import type { Payload } from 'payload'

import { consumeDiscountCodeRedemption } from '@/lib/stripe-connect/discountCodes'
import { issueRemainderDiscountCodeIfNeeded } from '@/lib/stripe-connect/issueRemainderDiscountCode'
import { issueSubscriptionGiftBalanceIfNeeded } from '@/lib/stripe-connect/issueSubscriptionGiftBalance'
import { resolveDiscountCodeForGiftCredit } from '@/lib/stripe-connect/resolveDiscountCodeForGiftCredit'

/** Plan/product price in euros from Checkout metadata (fee excluded). */
export function planPriceEurosFromMetadata(meta: Record<string, string | undefined>): number | null {
  const before = meta.classPriceBeforeDiscount
  if (before != null && before !== '') {
    const euros = Number(before)
    if (Number.isFinite(euros) && euros >= 0) return euros
  }
  const centsRaw = meta.planPriceAmount ?? meta.classPriceAmount
  if (centsRaw != null && centsRaw !== '') {
    const cents = Number(centsRaw)
    if (Number.isFinite(cents) && cents >= 0) return Number((cents / 100).toFixed(2))
  }
  return null
}

export async function handleClassPassGiftRemainder(params: {
  payload: Payload
  tenantId: number
  userId: number
  paymentIntentId: string
  metadata: Record<string, string | undefined>
  /** When Checkout used allow_promotion_codes, pass the Stripe promo id from session.discounts. */
  stripePromotionCodeId?: string | null
}): Promise<void> {
  const { payload, tenantId, userId, paymentIntentId, metadata: meta } = params
  const discountCodeMeta = await resolveDiscountCodeForGiftCredit({
    payload,
    tenantId,
    metadataDiscountCode: meta.discountCode,
    stripePromotionCodeId: params.stripePromotionCodeId,
  })
  if (!discountCodeMeta) {
    payload.logger?.info?.(
      `class_pass_purchase: no discount code resolved for gift remainder (transaction ${paymentIntentId})`,
    )
    return
  }

  const planPrice = planPriceEurosFromMetadata(meta)

  try {
    const consumed = await consumeDiscountCodeRedemption({
      payload,
      tenantId,
      discountCode: discountCodeMeta,
      idempotencyKey: paymentIntentId,
    })
    if (!consumed.ok) {
      payload.logger?.error?.(
        `class_pass_purchase: discount redemption failed (${consumed.reason}) for code ${discountCodeMeta} pi ${paymentIntentId}`,
      )
    }
  } catch (redeemErr) {
    payload.logger?.error?.(
      `class_pass_purchase: discount redemption failed: ${
        redeemErr instanceof Error ? redeemErr.message : String(redeemErr)
      }`,
    )
  }

  if (planPrice == null) return

  try {
    const userDoc = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const issued = await issueRemainderDiscountCodeIfNeeded({
      payload,
      tenantId,
      discountCode: discountCodeMeta,
      classPriceBeforeDiscount: planPrice,
      userId,
      userEmail:
        userDoc && typeof (userDoc as { email?: string }).email === 'string'
          ? (userDoc as { email: string }).email
          : null,
      paymentIntentId,
    })
    if (!issued.issued) {
      payload.logger?.info?.(
        `class_pass_purchase: remainder not issued (${issued.reason}) for code ${discountCodeMeta} pi ${paymentIntentId}`,
      )
    }
  } catch (remainderErr) {
    payload.logger?.error?.(
      `class_pass_purchase: remainder discount issue failed: ${
        remainderErr instanceof Error ? remainderErr.message : String(remainderErr)
      }`,
    )
  }
}

export async function handleSubscriptionGiftBalance(params: {
  payload: Payload
  tenantId: number
  userId: number
  subscriptionId: string
  stripeCustomerId: string
  stripeAccountId: string | null | undefined
  stripeStatus: string | null | undefined
  metadata: Record<string, string | undefined>
  /** When Checkout used allow_promotion_codes, pass the Stripe promo id from session/sub discounts. */
  stripePromotionCodeId?: string | null
}): Promise<void> {
  const {
    payload,
    tenantId,
    userId,
    subscriptionId,
    stripeCustomerId,
    stripeAccountId,
    stripeStatus,
    metadata: meta,
  } = params

  if (stripeStatus !== 'active' && stripeStatus !== 'trialing') return

  const discountCodeMeta = await resolveDiscountCodeForGiftCredit({
    payload,
    tenantId,
    metadataDiscountCode: meta.discountCode,
    stripePromotionCodeId: params.stripePromotionCodeId,
  })
  if (!discountCodeMeta) {
    payload.logger?.info?.(
      `subscription gift: no discount code resolved for balance credit (sub ${subscriptionId})`,
    )
    return
  }

  const accountId =
    typeof stripeAccountId === 'string' && stripeAccountId.trim()
      ? stripeAccountId.trim()
      : null
  if (!accountId || !stripeCustomerId) return

  const planPrice = planPriceEurosFromMetadata(meta)
  if (planPrice == null) return

  try {
    const consumed = await consumeDiscountCodeRedemption({
      payload,
      tenantId,
      discountCode: discountCodeMeta,
      idempotencyKey: subscriptionId,
    })
    if (!consumed.ok && consumed.reason !== 'exhausted' && consumed.reason !== 'inactive') {
      payload.logger?.error?.(
        `subscription gift: discount redemption failed (${consumed.reason}) for code ${discountCodeMeta} sub ${subscriptionId}`,
      )
    }
  } catch (redeemErr) {
    payload.logger?.error?.(
      `subscription gift: discount redemption failed: ${
        redeemErr instanceof Error ? redeemErr.message : String(redeemErr)
      }`,
    )
  }

  try {
    const userDoc = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    const credited = await issueSubscriptionGiftBalanceIfNeeded({
      payload,
      tenantId,
      discountCode: discountCodeMeta,
      planPriceBeforeDiscount: planPrice,
      stripeCustomerId,
      stripeAccountId: accountId,
      subscriptionId,
      userId,
      userEmail:
        userDoc && typeof (userDoc as { email?: string }).email === 'string'
          ? (userDoc as { email: string }).email
          : null,
    })
    if (!credited.credited) {
      payload.logger?.info?.(
        `subscription gift: balance not credited (${credited.reason}) for code ${discountCodeMeta} sub ${subscriptionId}`,
      )
    }
  } catch (balanceErr) {
    payload.logger?.error?.(
      `subscription gift: balance credit failed: ${
        balanceErr instanceof Error ? balanceErr.message : String(balanceErr)
      }`,
    )
  }
}

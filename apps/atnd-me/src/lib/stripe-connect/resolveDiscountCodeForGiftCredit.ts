/**
 * Resolve a Payload discount-codes row from a Stripe Promotion Code id on a Connect account.
 * Used when Checkout applies a promo via allow_promotion_codes and metadata.discountCode is missing.
 */
import type { Payload } from 'payload'

import { normalizeDiscountCode } from '@/lib/stripe-connect/discountCodes'

type DiscountCodeDoc = {
  id: number
  code?: string | null
  stripePromotionCodeId?: string | null
  status?: string | null
}

/** Pull the first promotion_code id from Checkout Session / Subscription discount shapes. */
export function extractStripePromotionCodeId(
  discounts: unknown,
): string | null {
  if (!Array.isArray(discounts) || discounts.length === 0) return null

  for (const entry of discounts) {
    if (!entry || typeof entry !== 'object') continue
    const promo = (entry as { promotion_code?: unknown }).promotion_code
    if (typeof promo === 'string' && promo.trim()) return promo.trim()
    if (promo && typeof promo === 'object') {
      const id = (promo as { id?: unknown }).id
      if (typeof id === 'string' && id.trim()) return id.trim()
    }
  }
  return null
}

/** Legacy Subscription.discount (singular) shape. */
export function extractStripePromotionCodeIdFromLegacyDiscount(
  discount: unknown,
): string | null {
  if (!discount || typeof discount !== 'object') return null
  const promo = (discount as { promotion_code?: unknown }).promotion_code
  if (typeof promo === 'string' && promo.trim()) return promo.trim()
  if (promo && typeof promo === 'object') {
    const id = (promo as { id?: unknown }).id
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

export async function findDiscountCodeByStripePromotionCodeId(
  payload: Payload,
  tenantId: number,
  stripePromotionCodeId: string,
): Promise<DiscountCodeDoc | null> {
  const promoId = stripePromotionCodeId.trim()
  if (!promoId) return null

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { stripePromotionCodeId: { equals: promoId } },
      ],
    },
  })

  return (match.docs[0] as DiscountCodeDoc | undefined) ?? null
}

/**
 * Prefer metadata.discountCode; otherwise look up the human code from a Stripe promo id.
 */
export async function resolveDiscountCodeForGiftCredit(params: {
  payload: Payload
  tenantId: number
  metadataDiscountCode?: string | null
  stripePromotionCodeId?: string | null
}): Promise<string | null> {
  const { payload, tenantId, metadataDiscountCode, stripePromotionCodeId } = params
  const fromMeta =
    typeof metadataDiscountCode === 'string' ? normalizeDiscountCode(metadataDiscountCode) : ''
  if (fromMeta) return fromMeta

  const promoId =
    typeof stripePromotionCodeId === 'string' && stripePromotionCodeId.trim()
      ? stripePromotionCodeId.trim()
      : null
  if (!promoId) return null

  const doc = await findDiscountCodeByStripePromotionCodeId(payload, tenantId, promoId)
  const code = doc?.code ? normalizeDiscountCode(String(doc.code)) : ''
  return code || null
}

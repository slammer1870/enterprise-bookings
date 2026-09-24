/**
 * Attributable drop-in revenue after trial, quantity, and promo discounts.
 */
import {
  applyPromoDiscount,
  calculateQuantityDiscount,
  type PromoDiscount,
} from '@repo/shared-utils'
import type { DiscountTier } from '@repo/shared-types'

export type { PromoDiscount }

export function attributedDropInRevenueCents(opts: {
  listPriceEuros: number
  discountTiers?: DiscountTier[] | null
  trialable: boolean
  promo?: PromoDiscount | null
  /** Charged class price stored on the transaction (wins when present, including €0). */
  storedAmountCents?: number | null
}): number {
  if (
    typeof opts.storedAmountCents === 'number' &&
    Number.isFinite(opts.storedAmountCents) &&
    opts.storedAmountCents >= 0
  ) {
    return Math.round(opts.storedAmountCents)
  }

  const listPrice =
    typeof opts.listPriceEuros === 'number' && Number.isFinite(opts.listPriceEuros)
      ? Math.max(0, opts.listPriceEuros)
      : 0

  const afterTier = calculateQuantityDiscount(
    listPrice,
    1,
    opts.discountTiers ?? undefined,
    opts.trialable,
  )
  const afterPromo = applyPromoDiscount({
    amount: afterTier.totalAmount,
    discount: opts.promo,
  })
  return Math.round(afterPromo.amount * 100)
}

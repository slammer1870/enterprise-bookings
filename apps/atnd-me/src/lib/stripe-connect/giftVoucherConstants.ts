/** Shared gift voucher amount bounds (safe for client + server). */
export const GIFT_VOUCHER_MIN_EUROS = 5
export const GIFT_VOUCHER_MAX_EUROS = 10_000
export const GIFT_VOUCHER_PURCHASE_TYPE = 'gift_voucher_purchase'

export function validateGiftVoucherAmount(amount: unknown): amount is number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return false
  if (amount < GIFT_VOUCHER_MIN_EUROS || amount > GIFT_VOUCHER_MAX_EUROS) return false
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > Number.EPSILON) return false
  return true
}

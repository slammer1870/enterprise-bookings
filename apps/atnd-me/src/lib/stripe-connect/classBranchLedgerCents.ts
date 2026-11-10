import type { Payload } from 'payload'

export type PrepaidGiftVoucher = {
  type?: string | null
  value?: number | null
  maxRedemptions?: number | null
  sourcePaymentIntentId?: string | null
  parentDiscountCode?: number | { id?: number | null } | null
  rootPurchasedAt?: string | null
  externalId?: string | null
}

/** A purchased gift voucher or its remainder, not an ordinary promo. */
export function isPrepaidGiftVoucher(doc: PrepaidGiftVoucher | null | undefined): boolean {
  if (!doc || doc.type !== 'amount_off' || doc.maxRedemptions !== 1) return false
  if (typeof doc.value !== 'number' || !(doc.value > 0)) return false
  if (typeof doc.sourcePaymentIntentId === 'string' && doc.sourcePaymentIntentId.trim()) return true
  if (typeof doc.parentDiscountCode === 'number' && Number.isFinite(doc.parentDiscountCode)) return true
  if (
    doc.parentDiscountCode &&
    typeof doc.parentDiscountCode === 'object' &&
    typeof doc.parentDiscountCode.id === 'number'
  ) {
    return true
  }
  if (typeof doc.rootPurchasedAt === 'string' && doc.rootPurchasedAt.trim()) return true
  if (typeof doc.externalId === 'string' && doc.externalId.trim()) return true
  return false
}

/**
 * Cents to store on the class booking rows.
 * Cash is what the customer still pays. Applied gift-voucher value is added back
 * so the branch line includes prepaid value the charge no longer collects.
 */
export function classBranchLedgerCents(params: {
  cashCents: number
  classPriceBeforeDiscountEuros?: number | null
  discount?: PrepaidGiftVoucher | null
}): number {
  const cash = Number.isFinite(params.cashCents) ? Math.max(0, Math.round(params.cashCents)) : 0
  if (!isPrepaidGiftVoucher(params.discount)) return cash
  const before = params.classPriceBeforeDiscountEuros
  if (before == null || !Number.isFinite(before) || before < 0) return cash
  const beforeCents = Math.round(before * 100)
  if (cash >= beforeCents) return cash
  const appliedCents = Math.round(Math.min(params.discount!.value as number, before) * 100)
  return Math.min(beforeCents, cash + appliedCents)
}

export async function classBranchLedgerCentsForCode(params: {
  payload: Payload
  tenantId: number
  discountCode?: string | null
  cashCents: number
  classPriceBeforeDiscountEuros?: number | null
}): Promise<number> {
  const code =
    typeof params.discountCode === 'string' ? params.discountCode.trim().toUpperCase() : ''
  if (!code) {
    return classBranchLedgerCents({ cashCents: params.cashCents })
  }

  const found = await params.payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ tenant: { equals: params.tenantId } }, { code: { equals: code } }],
    },
  })
  const doc = found.docs[0] as PrepaidGiftVoucher | undefined
  return classBranchLedgerCents({
    cashCents: params.cashCents,
    classPriceBeforeDiscountEuros: params.classPriceBeforeDiscountEuros,
    discount: doc,
  })
}

type BreakageDoc = PrepaidGiftVoucher & {
  id?: number
  redeemBy?: string | null
  timesRedeemed?: number | null
  breakageCents?: number | null
}

/**
 * Unused face value of an expired gift voucher, in cents.
 * An exhausted code has already moved its remainder onto another code, so it is not breakage.
 * Null when the code is not a prepaid voucher, is still redeemable, or was already recognized.
 */
export function expiredGiftVoucherBreakageCents(
  doc: BreakageDoc | null | undefined,
  now = new Date(),
): number | null {
  if (!doc || !isPrepaidGiftVoucher(doc) || doc.id == null) return null
  if (typeof doc.breakageCents === 'number') return null
  if (doc.maxRedemptions != null && (doc.timesRedeemed ?? 0) >= doc.maxRedemptions) return null
  if (!doc.redeemBy) return null
  const redeemBy = new Date(doc.redeemBy).getTime()
  if (!Number.isFinite(redeemBy) || redeemBy > now.getTime()) return null
  return Math.round((doc.value as number) * 100)
}

/** Record breakage once. An empty sale branch stays tenant-level. */
export async function recognizeGiftVoucherBreakage(
  payload: Payload,
  doc: BreakageDoc | null | undefined,
  now = new Date(),
): Promise<void> {
  const cents = expiredGiftVoucherBreakageCents(doc, now)
  if (cents == null || doc?.id == null) return
  await payload.update({
    collection: 'discount-codes',
    id: doc.id,
    data: { breakageCents: cents },
    overrideAccess: true,
    context: { skipStripeSync: true },
  })
}

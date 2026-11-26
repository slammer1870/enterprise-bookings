export type UpgradeConfirmPlanSnapshot = {
  planId: number
  name: string
  priceLabel: string | null
  /** Plan unit amount in cents (for recurring total). */
  priceCents: number | null
  /** Stripe price id used to look up platform fee for the new plan. */
  priceId: string | null
}

export type UpgradeConfirmFeeSnapshot = {
  bookingFeeCents: number
  totalCents: number
  currency: string
} | null

export function formatEuroCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

/** Recurring total shown in the upgrade confirm modal (plan + platform fee when known). */
export function upgradeConfirmTotalLabel(params: {
  newPlanPriceCents: number | null
  bookingFeeCents: number | null
}): string | null {
  const { newPlanPriceCents, bookingFeeCents } = params
  if (newPlanPriceCents == null || newPlanPriceCents < 0) return null
  const fee = bookingFeeCents != null && bookingFeeCents > 0 ? bookingFeeCents : 0
  return formatEuroCents(newPlanPriceCents + fee)
}

export function buildUpgradeConfirmCopy(params: {
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot
  fee: UpgradeConfirmFeeSnapshot
}): {
  title: string
  fromLabel: string
  toLabel: string
  feeLabel: string | null
  totalLabel: string | null
  notice: string
} {
  const { currentPlan, newPlan, fee } = params
  const fromLabel = currentPlan
    ? currentPlan.priceLabel
      ? `${currentPlan.name} (${currentPlan.priceLabel})`
      : currentPlan.name
    : 'Current membership'
  const toLabel = newPlan.priceLabel
    ? `${newPlan.name} (${newPlan.priceLabel})`
    : newPlan.name
  const feeLabel =
    fee && fee.bookingFeeCents > 0
      ? `Platform fee ${formatEuroCents(fee.bookingFeeCents)}`
      : null
  const totalLabel =
    fee && fee.totalCents > 0
      ? formatEuroCents(fee.totalCents)
      : upgradeConfirmTotalLabel({
          newPlanPriceCents: newPlan.priceCents,
          bookingFeeCents: fee?.bookingFeeCents ?? null,
        })

  return {
    title: 'Confirm subscription change',
    fromLabel,
    toLabel,
    feeLabel,
    totalLabel,
    notice:
      'Continuing will update your membership. Stripe may charge a prorated amount for the rest of this billing period.',
  }
}

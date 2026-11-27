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

export type UpgradeConfirmChargeTiming =
  | 'immediate'
  | 'next_invoice'
  | 'credit_immediate'
  | 'credit_next_invoice'
  | 'none'

export type UpgradeConfirmPreviewSnapshot = {
  chargeAmountCents: number
  chargeTiming: UpgradeConfirmChargeTiming
  currency: string
  nextPeriodEndUnix: number | null
  recurringTotalCents: number | null
  prorationDate: number
} | null

export function formatEuroCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export function formatMoneyCents(cents: number, currency = 'eur'): string {
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  } catch {
    return formatEuroCents(cents)
  }
}

export function formatUpgradePreviewDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

export function buildUpgradeChargeCopy(preview: NonNullable<UpgradeConfirmPreviewSnapshot>): {
  chargeAmountLabel: string
  chargeWhenLabel: string
  nextRenewalLabel: string | null
  notice: string
} {
  const money = (cents: number) => formatMoneyCents(cents, preview.currency)
  const absLabel = money(Math.abs(preview.chargeAmountCents))
  const whenDate =
    typeof preview.nextPeriodEndUnix === 'number'
      ? formatUpgradePreviewDate(preview.nextPeriodEndUnix)
      : null

  let chargeAmountLabel: string
  let chargeWhenLabel: string
  let notice: string

  switch (preview.chargeTiming) {
    case 'immediate':
      chargeAmountLabel = absLabel
      chargeWhenLabel = 'Due immediately'
      notice = `You'll be charged ${absLabel} immediately when you confirm.`
      break
    case 'credit_immediate':
      chargeAmountLabel = `−${absLabel}`
      chargeWhenLabel = 'Credit applied immediately'
      notice = `${absLabel} credit will be applied immediately when you confirm.`
      break
    case 'next_invoice':
      chargeAmountLabel = absLabel
      chargeWhenLabel = whenDate
        ? `Added to next invoice on ${whenDate}`
        : 'Added to your next invoice'
      notice = whenDate
        ? `A prorated ${absLabel} will be added to your next invoice on ${whenDate}.`
        : `A prorated ${absLabel} will be added to your next invoice.`
      break
    case 'credit_next_invoice':
      chargeAmountLabel = `−${absLabel}`
      chargeWhenLabel = whenDate
        ? `Credit on next invoice on ${whenDate}`
        : 'Credit on your next invoice'
      notice = whenDate
        ? `A ${absLabel} credit will appear on your next invoice on ${whenDate}.`
        : `A ${absLabel} credit will appear on your next invoice.`
      break
    case 'none':
    default:
      chargeAmountLabel = money(0)
      chargeWhenLabel = 'No charge today'
      notice = 'No prorated charge today for this plan change.'
      break
  }

  const recurringLabel =
    typeof preview.recurringTotalCents === 'number' && preview.recurringTotalCents >= 0
      ? money(preview.recurringTotalCents)
      : null

  const nextRenewalLabel =
    recurringLabel && whenDate
      ? `Then ${recurringLabel} starting ${whenDate}`
      : recurringLabel
        ? `Then ${recurringLabel} each billing period`
        : null

  return {
    chargeAmountLabel,
    chargeWhenLabel,
    nextRenewalLabel,
    notice,
  }
}

export function buildUpgradeConfirmCopy(params: {
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot
  fee: UpgradeConfirmFeeSnapshot
  preview?: UpgradeConfirmPreviewSnapshot
}): {
  title: string
  fromLabel: string
  toLabel: string
  feeLabel: string | null
  totalLabel: string | null
  chargeAmountLabel: string | null
  chargeWhenLabel: string | null
  nextRenewalLabel: string | null
  notice: string
} {
  const { currentPlan, newPlan, fee, preview } = params
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

  const previewTotal =
    preview && typeof preview.recurringTotalCents === 'number' && preview.recurringTotalCents > 0
      ? formatMoneyCents(preview.recurringTotalCents, preview.currency)
      : null

  const totalLabel =
    previewTotal ??
    (fee && fee.totalCents > 0
      ? formatEuroCents(fee.totalCents)
      : upgradeConfirmTotalLabel({
          newPlanPriceCents: newPlan.priceCents,
          bookingFeeCents: fee?.bookingFeeCents ?? null,
        }))

  const chargeCopy = preview ? buildUpgradeChargeCopy(preview) : null

  return {
    title: 'Confirm subscription change',
    fromLabel,
    toLabel,
    feeLabel,
    totalLabel,
    chargeAmountLabel: chargeCopy?.chargeAmountLabel ?? null,
    chargeWhenLabel: chargeCopy?.chargeWhenLabel ?? null,
    nextRenewalLabel: chargeCopy?.nextRenewalLabel ?? null,
    notice:
      chargeCopy?.notice ??
      'Continuing will update your membership. Stripe may charge a prorated amount for the rest of this billing period.',
  }
}

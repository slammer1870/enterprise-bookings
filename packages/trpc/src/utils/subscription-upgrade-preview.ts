/**
 * Pure helpers for summarizing a Stripe invoice.createPreview result for
 * subscription upgrades (prorated charge amount + when it is due).
 */

export type UpgradeProrationBehavior = "always_invoice" | "create_prorations";

export type UpgradeChargeTiming =
  | "immediate"
  | "next_invoice"
  | "credit_immediate"
  | "credit_next_invoice"
  | "none";

export type UpgradeInvoicePreviewLine = {
  amount: number;
  /** Stripe marks proration lines with `proration: true`. */
  proration?: boolean | null;
  periodStart?: number | null;
};

export function sumProrationLineCents(params: {
  lines: UpgradeInvoicePreviewLine[];
  /** When set, only include proration lines whose period start matches. */
  prorationDate?: number | null;
}): number {
  const { lines, prorationDate } = params;
  return lines.reduce((sum, line) => {
    if (!line.proration) return sum;
    if (
      typeof prorationDate === "number" &&
      typeof line.periodStart === "number" &&
      line.periodStart !== prorationDate
    ) {
      return sum;
    }
    return sum + (typeof line.amount === "number" ? line.amount : 0);
  }, 0);
}

/**
 * Pick the charge amount shown in the upgrade confirm modal.
 * - always_invoice: Stripe invoices now → use invoice amount_due
 * - create_prorations: prorations roll to next invoice → use proration line sum
 */
export function resolveUpgradeChargeAmountCents(params: {
  prorationBehavior: UpgradeProrationBehavior;
  amountDueCents: number;
  prorationCents: number;
}): number {
  const { prorationBehavior, amountDueCents, prorationCents } = params;
  if (prorationBehavior === "always_invoice") {
    return amountDueCents;
  }
  return prorationCents;
}

export function resolveUpgradeChargeTiming(params: {
  prorationBehavior: UpgradeProrationBehavior;
  chargeAmountCents: number;
}): UpgradeChargeTiming {
  const { prorationBehavior, chargeAmountCents } = params;
  if (chargeAmountCents === 0) return "none";
  if (prorationBehavior === "always_invoice") {
    return chargeAmountCents > 0 ? "immediate" : "credit_immediate";
  }
  return chargeAmountCents > 0 ? "next_invoice" : "credit_next_invoice";
}

export function summarizeUpgradeInvoicePreview(params: {
  prorationBehavior: UpgradeProrationBehavior;
  amountDueCents: number;
  prorationCents: number;
  currency: string;
  nextPeriodEndUnix: number | null;
  recurringTotalCents: number | null;
  formatMoney: (_cents: number, _currency: string) => string;
  formatDate: (_unix: number) => string;
}): {
  chargeAmountCents: number;
  chargeTiming: UpgradeChargeTiming;
  chargeAmountLabel: string;
  chargeWhenLabel: string;
  nextRenewalLabel: string | null;
  notice: string;
} {
  const {
    prorationBehavior,
    amountDueCents,
    prorationCents,
    currency,
    nextPeriodEndUnix,
    recurringTotalCents,
    formatMoney,
    formatDate,
  } = params;

  const chargeAmountCents = resolveUpgradeChargeAmountCents({
    prorationBehavior,
    amountDueCents,
    prorationCents,
  });
  const chargeTiming = resolveUpgradeChargeTiming({
    prorationBehavior,
    chargeAmountCents,
  });

  const absLabel = formatMoney(Math.abs(chargeAmountCents), currency);

  let chargeAmountLabel: string;
  let chargeWhenLabel: string;
  let notice: string;

  switch (chargeTiming) {
    case "immediate":
      chargeAmountLabel = absLabel;
      chargeWhenLabel = "Due immediately";
      notice = `You'll be charged ${absLabel} immediately when you confirm.`;
      break;
    case "credit_immediate":
      chargeAmountLabel = `−${absLabel}`;
      chargeWhenLabel = "Credit applied immediately";
      notice = `${absLabel} credit will be applied immediately when you confirm.`;
      break;
    case "next_invoice": {
      const when =
        typeof nextPeriodEndUnix === "number"
          ? `on ${formatDate(nextPeriodEndUnix)}`
          : "on your next invoice";
      chargeAmountLabel = absLabel;
      chargeWhenLabel = `Added to next invoice ${when}`;
      notice = `A prorated ${absLabel} will be added to your next invoice ${when}.`;
      break;
    }
    case "credit_next_invoice": {
      const when =
        typeof nextPeriodEndUnix === "number"
          ? `on ${formatDate(nextPeriodEndUnix)}`
          : "on your next invoice";
      chargeAmountLabel = `−${absLabel}`;
      chargeWhenLabel = `Credit on next invoice ${when}`;
      notice = `A ${absLabel} credit will appear on your next invoice ${when}.`;
      break;
    }
    case "none":
    default:
      chargeAmountLabel = formatMoney(0, currency);
      chargeWhenLabel = "No charge today";
      notice = "No prorated charge today for this plan change.";
      break;
  }

  const nextRenewalLabel =
    typeof recurringTotalCents === "number" &&
    recurringTotalCents >= 0 &&
    typeof nextPeriodEndUnix === "number"
      ? `Then ${formatMoney(recurringTotalCents, currency)} starting ${formatDate(nextPeriodEndUnix)}`
      : typeof recurringTotalCents === "number" && recurringTotalCents >= 0
        ? `Then ${formatMoney(recurringTotalCents, currency)} each billing period`
        : null;

  return {
    chargeAmountCents,
    chargeTiming,
    chargeAmountLabel,
    chargeWhenLabel,
    nextRenewalLabel,
    notice,
  };
}

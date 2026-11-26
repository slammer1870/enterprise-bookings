import { describe, expect, it } from "vitest";

import {
  resolveUpgradeChargeAmountCents,
  resolveUpgradeChargeTiming,
  summarizeUpgradeInvoicePreview,
  sumProrationLineCents,
} from "../src/utils/subscription-upgrade-preview";

describe("sumProrationLineCents", () => {
  it("sums only proration lines, optionally matching prorationDate", () => {
    expect(
      sumProrationLineCents({
        lines: [
          { amount: 1000, proration: true, periodStart: 100 },
          { amount: -400, proration: true, periodStart: 100 },
          { amount: 5000, proration: false, periodStart: 100 },
          { amount: 200, proration: true, periodStart: 99 },
        ],
        prorationDate: 100,
      }),
    ).toBe(600);
  });
});

describe("resolveUpgradeChargeAmountCents / timing", () => {
  it("uses amount_due for always_invoice", () => {
    expect(
      resolveUpgradeChargeAmountCents({
        prorationBehavior: "always_invoice",
        amountDueCents: 1234,
        prorationCents: 999,
      }),
    ).toBe(1234);
    expect(
      resolveUpgradeChargeTiming({
        prorationBehavior: "always_invoice",
        chargeAmountCents: 1234,
      }),
    ).toBe("immediate");
  });

  it("uses proration sum for create_prorations", () => {
    expect(
      resolveUpgradeChargeAmountCents({
        prorationBehavior: "create_prorations",
        amountDueCents: 9999,
        prorationCents: 450,
      }),
    ).toBe(450);
    expect(
      resolveUpgradeChargeTiming({
        prorationBehavior: "create_prorations",
        chargeAmountCents: 450,
      }),
    ).toBe("next_invoice");
  });

  it("handles zero and credit", () => {
    expect(
      resolveUpgradeChargeTiming({
        prorationBehavior: "always_invoice",
        chargeAmountCents: 0,
      }),
    ).toBe("none");
    expect(
      resolveUpgradeChargeTiming({
        prorationBehavior: "always_invoice",
        chargeAmountCents: -200,
      }),
    ).toBe("credit_immediate");
  });
});

describe("summarizeUpgradeInvoicePreview", () => {
  const formatMoney = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const formatDate = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  it("describes an immediate prorated charge", () => {
    const summary = summarizeUpgradeInvoicePreview({
      prorationBehavior: "always_invoice",
      amountDueCents: 1250,
      prorationCents: 1250,
      currency: "eur",
      nextPeriodEndUnix: 1735689600,
      recurringTotalCents: 5200,
      formatMoney,
      formatDate,
    });

    expect(summary.chargeAmountCents).toBe(1250);
    expect(summary.chargeTiming).toBe("immediate");
    expect(summary.chargeAmountLabel).toBe("€12.50");
    expect(summary.chargeWhenLabel).toBe("Due immediately");
    expect(summary.notice).toMatch(/charged €12\.50 immediately/i);
    expect(summary.nextRenewalLabel).toMatch(/^Then €52\.00 starting /);
  });

  it("describes a next-invoice proration", () => {
    const summary = summarizeUpgradeInvoicePreview({
      prorationBehavior: "create_prorations",
      amountDueCents: 5200,
      prorationCents: 800,
      currency: "eur",
      nextPeriodEndUnix: 1735689600,
      recurringTotalCents: 5200,
      formatMoney,
      formatDate,
    });

    expect(summary.chargeTiming).toBe("next_invoice");
    expect(summary.chargeWhenLabel).toMatch(/Added to next invoice on /);
    expect(summary.notice).toMatch(/prorated €8\.00/);
  });
});

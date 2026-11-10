"server-only";

import Stripe from "stripe";

const stripeTestRun = process.env.NODE_ENV === "test" || process.env.CI === "true";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ||
    "sk_test_51RJd8wQ1eJoLeXYetPtC4B7zSH6dj3xNhj4GcScG6xZ6TjaUxowuXYnW16w52e65cfRKirNlElrVsqixRti9Ovnf00ZZLGOPxf",
  {
    apiVersion: "2025-02-24.acacia" as Stripe.StripeConfig["apiVersion"],
    // Stripe's defaults retry for minutes. That blows Vitest's hookTimeout when a
    // test key cannot reach the API. Fail fast in tests.
    ...(stripeTestRun ? { timeout: 5_000, maxNetworkRetries: 0 } : {}),
  }
);

export function formatAmountForDisplay(
  amount: number,
  currency: string
): string {
  let numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency,
    currencyDisplay: "symbol",
  });
  return numberFormat.format(amount);
}

export function formatAmountForStripe(
  amount: number,
  currency: string
): number {
  let numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency,
    currencyDisplay: "symbol",
  });
  const parts = numberFormat.formatToParts(amount);
  let zeroDecimalCurrency: boolean = true;
  for (let part of parts) {
    if (part.type === "decimal") {
      zeroDecimalCurrency = false;
    }
  }
  return zeroDecimalCurrency ? amount : Math.round(amount * 100);
}

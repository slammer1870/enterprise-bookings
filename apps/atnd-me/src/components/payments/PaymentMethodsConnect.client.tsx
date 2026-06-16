"use client";

import type { ComponentProps } from "react";
import { PaymentMethods } from "@repo/payments-next";
import { DropInFeeBreakdown } from "./DropInFeeBreakdown.client";
import { ClassPassFeeBreakdown } from "./ClassPassFeeBreakdown.client";

/**
 * atnd-me routes PaymentIntents through a Connect-aware endpoint.
 * Includes fee breakdown (class price, booking fee, total) for drop-in and class pass payments.
 * Redirects to /success after payment (receipt page) instead of /dashboard.
 */
export function PaymentMethodsConnect(props: ComponentProps<typeof PaymentMethods>) {
  return (
    <PaymentMethods
      {...props}
      createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      createCheckoutSessionUrl="/api/stripe/connect/create-checkout-session"
      validateDiscountCodeUrl="/api/stripe/connect/validate-discount-code"
      FeeBreakdownComponent={DropInFeeBreakdown}
      ClassPassFeeBreakdownComponent={ClassPassFeeBreakdown}
      successUrl={props.successUrl ?? "/success"}
    />
  );
}


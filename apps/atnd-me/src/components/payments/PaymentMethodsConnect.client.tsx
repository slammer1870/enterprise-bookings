"use client";

import type { ComponentProps } from "react";
import { PaymentMethods } from "@repo/payments-next";
import { DropInFeeBreakdown } from "./DropInFeeBreakdown.client";

/**
 * atnd-me routes PaymentIntents through a Connect-aware endpoint.
 * Includes fee breakdown (class price, booking fee, total) when drop-in payment.
 * Redirects to /success after payment (receipt page) instead of /dashboard.
 */
export function PaymentMethodsConnect(props: ComponentProps<typeof PaymentMethods>) {
  return (
    <PaymentMethods
      {...props}
      createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      FeeBreakdownComponent={DropInFeeBreakdown}
      successUrl={props.successUrl ?? "/success"}
    />
  );
}


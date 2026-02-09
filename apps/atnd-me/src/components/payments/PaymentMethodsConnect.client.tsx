"use client";

import type { ComponentProps } from "react";
import { PaymentMethods } from "@repo/payments-next";

/**
 * atnd-me routes PaymentIntents through a Connect-aware endpoint.
 * Other apps can use `PaymentMethods` directly and will default to the plugin endpoint.
 */
export function PaymentMethodsConnect(props: ComponentProps<typeof PaymentMethods>) {
  return (
    <PaymentMethods
      {...props}
      createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
    />
  );
}


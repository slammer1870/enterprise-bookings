import { createPaymentIntent } from "../payments/endpoints/create-payment-intent";
import type { PaymentsConfig } from "../types";
import type { PluginContext } from "./context";

/**
 * Applies the create-payment-intent endpoint only. Transactions collection is
 * registered at plugin root when any of dropIns, classPass, or membership is enabled.
 */
export function applyPaymentsFeature(
  ctx: PluginContext,
  _payments: PaymentsConfig
): void {
  ctx.endpoints.push({
    path: "/stripe/create-payment-intent",
    method: "post",
    handler: createPaymentIntent,
  });
}

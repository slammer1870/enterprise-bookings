import { transactionsCollection } from "../payments/collections/transactions";
import { modifyUsersCollectionForPayments } from "../payments/collections/users";
import { customersProxy } from "../payments/endpoints/customers";
import { createPaymentIntent } from "../payments/endpoints/create-payment-intent";
import type { PaymentsConfig } from "../types";
import type { PluginContext } from "./context";

/**
 * Applies the payments feature: users (stripeCustomerId by default), transactions
 * collection, endpoints (customers, create-payment-intent), paymentIntentSucceeded webhook.
 * Does not add transactions (handled by the main plugin) or drop-ins (separate feature).
 */
export function applyPaymentsFeature(
  ctx: PluginContext,
  payments: PaymentsConfig
): void {
  const usersCollection = ctx.collections.find((c) => c.slug === "users");
  if (usersCollection) {
    ctx.collections = ctx.collections.filter((c) => c.slug !== "users");
    ctx.collections.push(modifyUsersCollectionForPayments(usersCollection));
  }
  ctx.endpoints.push({
    path: "/stripe/customers",
    method: "get",
    handler: customersProxy,
  });
  ctx.endpoints.push({
    path: "/stripe/create-payment-intent",
    method: "post",
    handler: createPaymentIntent,
  });
  ctx.collections = ctx.collections.filter((c) => c.slug !== "transactions");
  ctx.collections.push(transactionsCollection(payments.transactionsOverrides));
}

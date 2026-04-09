import type { Config, Plugin } from "payload";
import { transactionsCollection } from "../collections/transactions";
import type { BookingsPaymentsPluginConfig } from "../types";
import type { PluginContext } from "./context";
import { applyDropInsFeature } from "./apply-drop-ins";
import { applyClassPassFeature } from "./apply-class-pass";
import { applyPaymentsFeature } from "./apply-payments";
import { applyMembershipFeature } from "./apply-membership";
import { injectTransactionsIntoBookings } from "./inject-transactions";
import { modifyUsersCollectionForPayments } from "../payments/collections/users";
import { createCustomersProxy, customersProxy } from "../payments/endpoints/customers";

/** Normalize feature option: true → default config; false → undefined; object → use as-is (ensure enabled). */
function normalizeFeatureOption<T extends { enabled?: boolean }>(
  value: boolean | T | undefined,
  defaultWhenTrue: T
): T | undefined {
  if (value === undefined) return undefined;
  if (value === true) return defaultWhenTrue;
  if (value === false) return undefined;
  return { ...value, enabled: value.enabled !== false } as T;
}

/**
 * Unified bookings-payments plugin. Each feature uses the same config shape:
 * `true` (enable with defaults) or a config object.
 *
 * - dropIns: drop-ins collection + card payments (transactions, create-payment-intent)
 * - classPass: class-pass-types, class-passes, transactions
 * - membership: plans, subscriptions, checkout/portal endpoints
 *
 * @example
 * bookingsPaymentsPlugin({
 *   dropIns: true,
 *   classPass: true,
 *   membership: true,
 * })
 */
export const bookingsPaymentsPlugin =
  (pluginOptions: BookingsPaymentsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    const config = { ...incomingConfig };
    const dropIns = normalizeFeatureOption(pluginOptions.dropIns, {
      enabled: true,
      paymentMethodSlugs: ["event-types"],
    });
    const classPass = normalizeFeatureOption(pluginOptions.classPass, {
      enabled: true,
      eventTypesSlug: "event-types",
    });
    const membership = normalizeFeatureOption(pluginOptions.membership, {
      enabled: true,
      paymentMethodSlugs: [],
    });

    const anyEnabled = dropIns?.enabled || classPass?.enabled || membership?.enabled;
    if (!anyEnabled) {
      return config;
    }

    // Handle endpoints as array or function (Payload types may only expose array; runtime can be function)
    const rawEndpoints = config.endpoints;
    const existingEndpoints: NonNullable<Config["endpoints"]> =
      typeof rawEndpoints === "function"
        ? (rawEndpoints as (_prev: unknown[]) => NonNullable<Config["endpoints"]>)([])
        : rawEndpoints ?? [];

    const ctx: PluginContext = {
      collections: [...(config.collections || [])],
      endpoints: [...existingEndpoints],
      config,
    };

    // Drop-ins (unified): drop-ins collection, allowedDropIn, transactions, create-payment-intent
    if (dropIns?.enabled) {
      applyDropInsFeature(ctx, dropIns);
      applyPaymentsFeature(ctx, {
        enabled: true,
        transactionsOverrides: dropIns.transactionsOverrides,
        bookingTransactionsOverrides: dropIns.bookingTransactionsOverrides,
      });
    }

    // Class-pass feature: class-passes collection, allowedClassPasses injection
    if (classPass?.enabled) {
      applyClassPassFeature(ctx, classPass);
    }

    // Membership feature: memberships, subscriptions, users, endpoints, allowedPlans injection
    if (membership?.enabled) {
      applyMembershipFeature(ctx, membership);
    }

    // Transactions at root: one collection for subscription, class-pass, or drop-in booking payments
    const needsTransactions =
      !ctx.collections.some((c) => c.slug === "transactions");
    if (needsTransactions) {
      ctx.collections.push(
        transactionsCollection(
          classPass?.bookingTransactionsOverrides ??
            dropIns?.bookingTransactionsOverrides
        )
      );
      const bookingsCol = ctx.collections.find((c) => c.slug === "bookings");
      if (bookingsCol) {
        injectTransactionsIntoBookings(bookingsCol);
      }
    }

    // Platform Stripe proxy endpoints (admin-only, use platform Stripe API for CustomSelect):
    // - GET /stripe/customers (main plugin, when dropIns or membership)
    // - GET /stripe/plans, GET /stripe/subscriptions (applyMembershipFeature)
    // - GET /stripe/class-pass-products (applyClassPassFeature)
    const needsStripeCustomer = dropIns?.enabled || membership?.enabled;
    if (needsStripeCustomer) {
      const usersCollection = ctx.collections.find((c) => c.slug === "users");
      if (usersCollection) {
        ctx.collections = ctx.collections.filter((c) => c.slug !== "users");
        ctx.collections.push(modifyUsersCollectionForPayments(usersCollection));
      }
      const hasCustomersEndpoint = ctx.endpoints.some(
        (e) => typeof e === "object" && e !== null && "path" in e && e.path === "/stripe/customers"
      );
      if (!hasCustomersEndpoint) {
        const getStripeAccountIdForRequest =
          membership?.getStripeAccountIdForRequest ?? dropIns?.getStripeAccountIdForRequest ?? undefined;
        // Default to platform for backwards compatibility; apps can change to 'auto'/'connect' by
        // overriding this endpoint or adjusting the plugin in the future.
        const handler =
          getStripeAccountIdForRequest
            ? createCustomersProxy({ getStripeAccountIdForRequest, scope: "platform" })
            : customersProxy;
        ctx.endpoints.push({
          path: "/stripe/customers",
          method: "get",
          handler,
        });
      }
    }

    config.collections = ctx.collections;
    config.endpoints = ctx.endpoints;

    return config;
  };

import type { Config, Plugin } from "payload";
import { transactionsCollection } from "../collections/transactions";
import type {
  BookingsPaymentsPluginConfig,
  DropInsConfig,
  ClassPassConfig,
  PaymentsConfig,
  MembershipConfig,
} from "../types";
import type { PluginContext } from "./context";
import { applyDropInsFeature } from "./apply-drop-ins";
import { applyClassPassFeature } from "./apply-class-pass";
import { applyPaymentsFeature } from "./apply-payments";
import { applyMembershipFeature } from "./apply-membership";
import { injectTransactionsIntoBookings } from "./inject-transactions";

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
 * - dropIns: true | DropInsConfig
 * - classPass: true | ClassPassConfig
 * - payments: true | PaymentsConfig
 * - membership (subscriptions): true | MembershipConfig
 *
 * @example
 * // Shorthand: enable with defaults
 * bookingsPaymentsPlugin({
 *   dropIns: true,
 *   classPass: true,
 *   payments: true,
 *   membership: true,
 * })
 *
 * @example
 * // Config objects
 * bookingsPaymentsPlugin({
 *   dropIns: { enabled: true, paymentMethodSlugs: ['class-options'] },
 *   classPass: { enabled: true, classOptionsSlug: 'class-options' },
 *   payments: { enabled: true },
 *   membership: { enabled: true, paymentMethodSlugs: ['class-options'] },
 * })
 */
/** Backward compat: when payments.enableDropIns is true and dropIns not set, enable dropIns from payments config. */
function resolveDropIns(
  pluginOptions: BookingsPaymentsPluginConfig
): DropInsConfig | undefined {
  const explicit = normalizeFeatureOption(pluginOptions.dropIns, {
    enabled: true,
    paymentMethodSlugs: ["class-options"],
    acceptedPaymentMethods: ["cash", "card"],
  });
  if (explicit !== undefined) return explicit;
  const payments = pluginOptions.payments;
  if (typeof payments === "object" && payments?.enableDropIns === true) {
    return {
      enabled: true,
      paymentMethodSlugs: payments.paymentMethodSlugs ?? ["class-options"],
      acceptedPaymentMethods: payments.acceptedPaymentMethods ?? ["cash", "card"],
    };
  }
  return undefined;
}

export const bookingsPaymentsPlugin =
  (pluginOptions: BookingsPaymentsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    const config = { ...incomingConfig };
    const dropIns = resolveDropIns(pluginOptions);
    const classPass = normalizeFeatureOption(pluginOptions.classPass, {
      enabled: true,
      classOptionsSlug: "class-options",
    });
    const payments = normalizeFeatureOption(pluginOptions.payments, { enabled: true });
    const membership = normalizeFeatureOption(pluginOptions.membership, {
      enabled: true,
      paymentMethodSlugs: [],
    });

    const anyEnabled = dropIns?.enabled || classPass?.enabled || payments?.enabled || membership?.enabled;
    if (!anyEnabled) {
      return config;
    }

    // Handle endpoints as array or function (Payload types may only expose array; runtime can be function)
    const rawEndpoints = config.endpoints;
    const existingEndpoints: NonNullable<Config["endpoints"]> =
      typeof rawEndpoints === "function"
        ? (rawEndpoints as (prev: unknown[]) => NonNullable<Config["endpoints"]>)([])
        : rawEndpoints ?? [];

    const ctx: PluginContext = {
      collections: [...(config.collections || [])],
      endpoints: [...existingEndpoints],
      config,
    };

    // Drop-ins feature: drop-ins collection, allowedDropIn injection
    if (dropIns?.enabled) {
      applyDropInsFeature(ctx, dropIns);
    }

    // Payments feature: users, transactions, endpoints
    if (payments?.enabled) {
      applyPaymentsFeature(ctx, payments);
    }

    // Class-pass feature: class-passes collection, allowedClassPasses injection
    if (classPass?.enabled) {
      applyClassPassFeature(ctx, classPass);
    }

    // Shared: transactions when classPass OR payments (single collection; db table booking_transactions).
    // Also inject "transactions" relationship into bookings so admins can see payment records.
    const needsTransactions =
      (classPass?.enabled || payments?.enabled) &&
      !ctx.collections.some((c) => c.slug === "transactions");
    if (needsTransactions) {
      ctx.collections.push(
        transactionsCollection(
          classPass?.bookingTransactionsOverrides ??
            payments?.bookingTransactionsOverrides
        )
      );
      const bookingsCol = ctx.collections.find((c) => c.slug === "bookings");
      if (bookingsCol) {
        injectTransactionsIntoBookings(bookingsCol);
      }
    }

    // Membership feature: memberships, subscriptions, users, endpoints, allowedPlans injection
    if (membership?.enabled) {
      applyMembershipFeature(ctx, membership);
    }

    config.collections = ctx.collections;
    config.endpoints = ctx.endpoints;

    return config;
  };

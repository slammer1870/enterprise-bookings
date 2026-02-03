import type { CollectionConfig } from "payload";
import type { FieldsOverride, HooksOverride } from "@repo/shared-types";

/** Overrides for a collection: access, fields, and/or hooks. Used for multi-tenant and app-specific customization. */
export type CollectionOverrides = {
  access?: Partial<NonNullable<CollectionConfig["access"]>>;
  fields?: FieldsOverride;
  hooks?: HooksOverride;
};

/**
 * Class-pass feature config. When enabled, adds class-pass-types, class-passes collections,
 * allowedClassPasses (relationship to types) injection into class-options, checkClassPass utility, and decrement hook.
 */
export type ClassPassConfig = {
  enabled: boolean;
  classOptionsSlug?: string;
  adminGroup?: string;
  /** Override access/fields/hooks for transactions (e.g. tenant-scoped access in multi-tenant apps). */
  bookingTransactionsOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for class-passes (e.g. tenant-scoped access in multi-tenant apps). */
  classPassesOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for class-pass-types (e.g. tenant-scoped in multi-tenant apps). */
  classPassTypesOverrides?: CollectionOverrides;
};

/**
 * Drop-ins feature config. When enabled, adds drop-ins collection and allowedDropIn
 * injection into configured payment-method collections. Independent of payments processing.
 */
export type DropInsConfig = {
  enabled: boolean;
  acceptedPaymentMethods?: ("cash" | "card")[];
  paymentMethodSlugs?: string[];
  /** Override access/fields/hooks for drop-ins (e.g. tenant-scoped in multi-tenant apps). */
  dropInsOverrides?: CollectionOverrides;
};

/**
 * Payments feature config. When enabled, adds transactions collection,
 * users (stripeCustomerId), endpoints (customers, create-payment-intent), paymentIntentSucceeded webhook.
 * Note: Drop-ins are now a separate feature (use dropIns config).
 */
export type PaymentsConfig = {
  enabled: boolean;
  /**
   * @deprecated Use top-level `dropIns: { enabled: true, ... }` instead.
   * If true and `dropIns` is not set, drop-ins are enabled using paymentMethodSlugs and acceptedPaymentMethods below.
   */
  enableDropIns?: boolean;
  /** Used when enableDropIns is true (backward compat). Prefer dropIns.paymentMethodSlugs. */
  paymentMethodSlugs?: string[];
  /** Used when enableDropIns is true (backward compat). Prefer dropIns.acceptedPaymentMethods. */
  acceptedPaymentMethods?: ("cash" | "card")[];
  /** Override access/fields/hooks for transactions (e.g. tenant-scoped in multi-tenant apps). */
  transactionsOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for transactions when payments enabled but classPass disabled. */
  bookingTransactionsOverrides?: CollectionOverrides;
};

/**
 * Optional callback for subscription checkout: return booking fee in cents to add
 * as a second line item in Stripe Checkout so the fee is visible to the customer.
 * Handler fetches the plan price, passes classPriceAmountCents and tenantId (from metadata).
 */
export type GetSubscriptionBookingFeeCents = (params: {
  payload: import("payload").Payload;
  tenantId: number;
  classPriceAmountCents: number;
  metadata?: Record<string, string>;
}) => Promise<number>;

/**
 * Membership feature config. When enabled, adds memberships, subscriptions,
 * users (userSubscription), membership endpoints, subscription webhooks, sync job.
 */
export type MembershipConfig = {
  enabled: boolean;
  paymentMethodSlugs?: string[];
  /**
   * When set, subscription Stripe Checkout adds a second line item "Booking fee" with this amount (cents).
   * Caller must pass metadata.tenantId; handler uses Stripe Price to get classPriceAmountCents.
   */
  getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
  subscriptionOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
  } & Partial<Omit<CollectionConfig, "fields">>;
  plansOverrides?: {
    fields?: FieldsOverride;
    hooks?: HooksOverride;
  } & Partial<Omit<CollectionConfig, "fields">>;
};

/**
 * Shape for a feature option: either `true` (enable with defaults) or a config object.
 * Used for dropIns, classPass, payments, and membership (subscriptions).
 */
export type FeatureOption<T> = true | T;

/**
 * Unified bookings-payments plugin config. Each feature accepts the same shape:
 * `true` (enable with defaults) or a config object.
 */
export type BookingsPaymentsPluginConfig = {
  /** Drop-ins: `true` or `{ ...DropInsConfig }` */
  dropIns?: FeatureOption<DropInsConfig>;
  /** Class-pass: `true` or `{ ...ClassPassConfig }` */
  classPass?: FeatureOption<ClassPassConfig>;
  /** Payments: `true` or `{ ...PaymentsConfig }` */
  payments?: FeatureOption<PaymentsConfig>;
  /** Membership (subscriptions): `true` or `{ ...MembershipConfig }` */
  membership?: FeatureOption<MembershipConfig>;
};

export type ClassPassLike = {
  id?: number;
  user?: number | { id: number };
  tenant?: number | { id: number };
  type?: number | { id: number };
  quantity?: number;
  expirationDate?: string;
  status?: string;
};

export type ClassOptionLike = {
  paymentMethods?: {
    /** Relationship to class-pass-types (array of IDs or objects). Which pass types are accepted. */
    allowedClassPasses?: unknown[] | null;
    paymentsEnabled?: boolean;
  };
};

export type UserLike = { id: number };
export type TenantLike = { id: number };

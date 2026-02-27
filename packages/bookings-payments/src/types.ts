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
/** Optional: resolve Stripe Connect account ID for proxy requests (e.g. from tenant cookie). When set, plans/class-pass-products proxies list from this account. */
export type GetStripeAccountIdForRequest = (
  _req: import("payload").PayloadRequest
) => Promise<string | null> | string | null;

export type ClassPassConfig = {
  enabled: boolean;
  classOptionsSlug?: string;
  adminGroup?: string;
  /**
   * Controls which Stripe account GET /stripe/class-pass-products uses for CustomSelect.
   * - auto: if getStripeAccountIdForRequest returns an accountId, list from that Connect account; otherwise platform (default)
   * - connect: always list from the resolved Connect account (400 if none)
   * - platform: always list from platform
   */
  productsProxyScope?: "platform" | "auto" | "connect";
  /** When set, GET /stripe/class-pass-products lists products from this Connect account (tenant-aware). */
  getStripeAccountIdForRequest?: GetStripeAccountIdForRequest;
  /** Override access/fields/hooks for transactions (e.g. tenant-scoped access in multi-tenant apps). */
  bookingTransactionsOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for class-passes (e.g. tenant-scoped access in multi-tenant apps). */
  classPassesOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for class-pass-types (e.g. tenant-scoped in multi-tenant apps). */
  classPassTypesOverrides?: CollectionOverrides;
};

/**
 * Drop-ins feature config. When enabled, adds drop-ins collection, allowedDropIn injection,
 * transactions collection, and Stripe endpoints (customers, create-payment-intent).
 */
export type DropInsConfig = {
  enabled: boolean;
  paymentMethodSlugs?: string[];
  /** Optional: resolve Stripe Connect account ID for proxy requests (e.g. from tenant cookie). When set, customer proxies can be tenant-aware. */
  getStripeAccountIdForRequest?: GetStripeAccountIdForRequest;
  /** Override access/fields/hooks for drop-ins (e.g. tenant-scoped in multi-tenant apps). */
  dropInsOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for transactions (e.g. tenant-scoped in multi-tenant apps). */
  transactionsOverrides?: CollectionOverrides;
  /** Override access/fields/hooks for transactions when dropIns enabled but classPass disabled. */
  bookingTransactionsOverrides?: CollectionOverrides;
};

/** Internal: used when applying transactions + create-payment-intent (unified under dropIns). */
export type PaymentsConfig = {
  enabled: boolean;
  transactionsOverrides?: CollectionOverrides;
  bookingTransactionsOverrides?: CollectionOverrides;
};

/**
 * Optional callback for subscription checkout: return booking fee in cents to add
 * as a second line item in Stripe Checkout so the fee is visible to the customer.
 * Handler fetches the plan price, passes classPriceAmountCents and tenantId (from metadata).
 */
export type GetSubscriptionBookingFeeCents = (_params: {
  payload: import("payload").Payload;
  tenantId: number;
  classPriceAmountCents: number;
  metadata?: Record<string, string>;
}) => Promise<number>;

/**
 * Membership feature config. When enabled, adds memberships, subscriptions,
 * users (userSubscription), membership endpoints, subscription webhooks, and optionally the sync job.
 */
export type MembershipConfig = {
  enabled: boolean;
  paymentMethodSlugs?: string[];
  /** When set, GET /stripe/plans lists products from this Connect account (tenant-aware). */
  getStripeAccountIdForRequest?: GetStripeAccountIdForRequest;
  /**
   * Membership billing account scope (Option A: Connect as source-of-truth).
   * - platform: create checkout + portal sessions on the platform Stripe account (default)
   * - auto: if getStripeAccountIdForRequest resolves, use that Connect account; otherwise platform
   * - connect: always use the resolved Connect account (400 if none)
   */
  scope?: "platform" | "auto" | "connect";
  /**
   * Optional Connect application fee taken from each subscription invoice total.
   * Only applies when scope is "auto" or "connect" and the subscription is created for a connected account.
   */
  subscriptionApplicationFeePercent?: number;
  /**
   * Controls which Stripe account GET /stripe/subscriptions uses for CustomSelect.
   * - platform: always list from the platform Stripe account (default; backwards compatible)
   * - auto: if getStripeAccountIdForRequest returns an accountId, list from that Connect account; otherwise platform
   * - connect: always list from the resolved Connect account (400 if none)
   */
  subscriptionsProxyScope?: "platform" | "auto" | "connect";
  /**
   * When true, registers the sync-stripe-subscriptions endpoint and syncStripeSubscriptions task.
   * When false or omitted, sync is not registered (opt-in). Apps that need the sync must set this to true.
   */
  syncStripeSubscriptions?: boolean;
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
  /** Drop-ins + card payments: drop-ins collection, transactions, create-payment-intent. */
  dropIns?: FeatureOption<DropInsConfig>;
  /** Class-pass: `true` or `{ ...ClassPassConfig }` */
  classPass?: FeatureOption<ClassPassConfig>;
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

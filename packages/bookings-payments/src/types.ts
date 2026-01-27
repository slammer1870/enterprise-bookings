import type { CollectionConfig } from "payload";
import type { FieldsOverride, HooksOverride } from "@repo/shared-types";

/** Overrides for a collection: access, fields, and/or hooks. Used for multi-tenant and app-specific customization. */
export type CollectionOverrides = {
  access?: Partial<NonNullable<CollectionConfig["access"]>>;
  fields?: FieldsOverride;
  hooks?: HooksOverride;
};

export type BookingsPaymentsPluginConfig = {
  /**
   * Class-pass: class-passes collection, allowedClassPasses injection, checkClassPass, decrement hook.
   */
  classPass?: {
    enabled: boolean;
    classOptionsSlug?: string;
    adminGroup?: string;
    /** Override access/fields/hooks for booking-transactions (e.g. tenant-scoped access in multi-tenant apps). */
    bookingTransactionsOverrides?: CollectionOverrides;
    /** Override access/fields/hooks for class-passes (e.g. tenant-scoped access in multi-tenant apps). */
    classPassesOverrides?: CollectionOverrides;
  };
  /**
   * Payments: drop-ins, transactions, users (stripeCustomerId), endpoints (customers, create-payment-intent), paymentIntentSucceeded.
   */
  payments?: {
    enabled: boolean;
    enableDropIns?: boolean;
    acceptedPaymentMethods?: ("cash" | "card")[];
    paymentMethodSlugs?: string[];
    /** Override access/fields/hooks for transactions (e.g. tenant-scoped in multi-tenant apps). */
    transactionsOverrides?: CollectionOverrides;
    /** Override access/fields/hooks for drop-ins (e.g. tenant-scoped in multi-tenant apps). */
    dropInsOverrides?: CollectionOverrides;
    /** Override access/fields/hooks for booking-transactions when payments enabled but classPass disabled. */
    bookingTransactionsOverrides?: CollectionOverrides;
  };
  /**
   * Membership: plans, subscriptions, users (userSubscription), membership endpoints, subscription webhooks.
   */
  membership?: {
    enabled: boolean;
    paymentMethodSlugs?: string[];
    subscriptionOverrides?: {
      fields?: FieldsOverride;
      hooks?: HooksOverride;
    } & Partial<Omit<CollectionConfig, "fields">>;
    plansOverrides?: {
      fields?: FieldsOverride;
      hooks?: HooksOverride;
    } & Partial<Omit<CollectionConfig, "fields">>;
  };
};

export type ClassPassLike = {
  id?: number;
  user?: number | { id: number };
  tenant?: number | { id: number };
  quantity?: number;
  originalQuantity?: number;
  expirationDate?: string;
  status?: string;
};

export type ClassOptionLike = {
  paymentMethods?: {
    allowedClassPasses?: boolean;
    paymentsEnabled?: boolean;
  };
};

export type UserLike = { id: number };
export type TenantLike = { id: number };

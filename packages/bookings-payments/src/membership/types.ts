import type { CollectionConfig } from "payload";
import type { FieldsOverride, HooksOverride } from "@repo/shared-types";

/**
 * Config shape for the membership branch when used inside BookingsPaymentsPluginConfig.membership.
 * Kept in sync with the merged type in ../types.ts for the membership key.
 */
export type MembershipBranchConfig = {
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

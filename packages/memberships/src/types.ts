import { CollectionConfig } from "payload";
import { FieldsOverride, HooksOverride } from "@repo/shared-types";

export type MembershipsPluginConfig = {
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

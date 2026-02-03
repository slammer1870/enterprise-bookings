import type { CollectionConfig } from "payload";
import { stripeCustomerId } from "../fields/stripe-customer-id";
import { createStripeCustomer } from "../hooks/create-stripe-customer";

export function modifyUsersCollectionForPayments(
  existingCollectionConfig: CollectionConfig
): CollectionConfig {
  const fields = existingCollectionConfig.fields ?? [];
  const hasStripeCustomerId = fields.some(
    (f) => "name" in f && f.name === "stripeCustomerId"
  );
  if (!hasStripeCustomerId) {
    fields.push(stripeCustomerId);
  }

  const hooks = { ...existingCollectionConfig.hooks };
  if (!Array.isArray(hooks.beforeChange)) {
    hooks.beforeChange = [];
  }
  (hooks.beforeChange as unknown[]).push(createStripeCustomer);

  return { ...existingCollectionConfig, fields, hooks };
}

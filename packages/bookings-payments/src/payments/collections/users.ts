import type { CollectionConfig } from "payload";
import { stripeCustomerId } from "../fields/stripe-customer-id";
import { createStripeCustomer } from "../hooks/create-stripe-customer";

const stripeCustomersMappingField = {
  name: "stripeCustomers",
  type: "array",
  label: "Stripe Customers (per account)",
  admin: { hidden: true },
  fields: [
    { name: "stripeAccountId", type: "text", required: true },
    { name: "stripeCustomerId", type: "text", required: true },
  ],
} as const;

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

  const hasStripeCustomers = fields.some(
    (f) => "name" in f && (f as any).name === "stripeCustomers"
  );
  if (!hasStripeCustomers) {
    fields.push(stripeCustomersMappingField as any);
  }

  const hooks = { ...existingCollectionConfig.hooks };
  if (!Array.isArray(hooks.beforeChange)) {
    hooks.beforeChange = [];
  }
  (hooks.beforeChange as unknown[]).push(createStripeCustomer);

  return { ...existingCollectionConfig, fields, hooks };
}

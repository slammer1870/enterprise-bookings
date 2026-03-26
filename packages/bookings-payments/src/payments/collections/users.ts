import type { CollectionConfig } from "payload";
import { stripeCustomerId } from "../fields/stripe-customer-id";
import { createStripeCustomer } from "../hooks/create-stripe-customer";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

const stripeCustomersMappingField = {
  name: "stripeCustomers",
  type: "array",
  label: "Stripe Customers (per account)",
  admin: { hidden: true },
  access: {
    read: ({ req: { user } }: { req: { user?: unknown } }) =>
      checkRole(["admin"], user as User | null),
    update: ({ req: { user } }: { req: { user?: unknown } }) =>
      checkRole(["admin"], user as User | null),
    create: ({ req: { user } }: { req: { user?: unknown } }) =>
      checkRole(["admin"], user as User | null),
  },
  fields: [
    { name: "stripeAccountId", type: "text", required: true },
    { name: "stripeCustomerId", type: "text", required: true },
  ],
  saveToJWT: false,
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

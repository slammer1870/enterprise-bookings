import { CollectionConfig, SelectField } from "payload";

import { stripeCustomerId } from "../fields/stripe-customer-id";

import { ensureFirstUserIsAdmin } from "../hooks/ensure-first-user-is-admin";
import { createStripeCustomer } from "../hooks/create-stripe-customer";

import { checkRole } from "@repo/shared-utils/src/check-role";

export const modifyUsersCollection = (
  existingCollectionConfig: CollectionConfig
): CollectionConfig => {
  const fields = existingCollectionConfig.fields || [];

  //TODO: Refactor this to create separate roles plugin

  const existingStripeCustomerIdField = fields.find(
    (field) => "stripeCustomerId" in field
  );

  if (!existingStripeCustomerIdField) {
    fields.push(stripeCustomerId);
  }

  const hooks = existingCollectionConfig.hooks || {};

  if (!hooks.beforeChange) {
    hooks.beforeChange = [];
  }
  hooks.beforeChange.push(createStripeCustomer);

  return {
    ...existingCollectionConfig,
    fields,
    hooks,
  };
};

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
  const existingRolesField = fields.find(
    (field) => "roles" in field
  ) as SelectField;

  if (existingRolesField) {
    const existingAdminRole = existingRolesField.options.find(
      (role) => role.toString() === "admin"
    );
    if (!existingAdminRole) {
      existingRolesField.options.push({
        label: "Admin",
        value: "admin",
      });
    }
  } else {
    fields.push({
      name: "roles",
      type: "select",
      label: "Roles",
      options: [
        {
          label: "admin",
          value: "admin",
        },
        {
          label: "customer",
          value: "customer",
        },
      ],
      defaultValue: ["customer"],
      hasMany: true,
      access: {
        create: ({ req: { user } }) => checkRole(["admin"], user as any),
        read: ({ req: { user } }) => checkRole(["admin"], user as any),
        update: ({ req: { user } }) => checkRole(["admin"], user as any),
      },
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
    });
  }

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

import { CollectionConfig, SelectField } from "payload";

import { ensureFirstUserIsAdmin } from "../hooks/users/ensureFirstUserIsAdmin";
import { createStripeCustomer } from "../hooks/users/createStripeCustomer";

import { customersProxy } from "../endpoints/stripe-customers";

import { checkRole } from "@repo/shared-utils/src/check-role";

export const modifyUsersCollection = (
  existingCollectionConfig: CollectionConfig
): CollectionConfig => {
  const fields = existingCollectionConfig.fields || [];

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
    (field) => "stripeCustomerID" in field
  );

  if (!existingStripeCustomerIdField) {
    fields.push({
      name: "stripeCustomerID",
      type: "text",
      label: "Stripe Customer",
      access: {
        read: ({ req: { user } }) => checkRole(["admin"], user as any),
      },
      admin: {
        components: {
          Field: "@repo/bookings/src/components/customer-select#CustomerSelect",
        },
        position: "sidebar",
      },
    });
  }

  const hooks = existingCollectionConfig.hooks || {};

  hooks.beforeChange = [...(hooks.beforeChange || []), createStripeCustomer];

  const endpoints = existingCollectionConfig.endpoints || [];

  endpoints.push({
    path: "/stripe-customers",
    method: "get",
    handler: customersProxy,
  });

  return {
    ...existingCollectionConfig,
    fields,
    hooks,
  };
};

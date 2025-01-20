import { CollectionConfig, SelectField } from "payload";
import { ensureFirstUserIsAdmin } from "../hooks/users/ensureFirstUserIsAdmin";
import { createStripeCustomer } from "../hooks/users/createStripeCustomer";

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
        create: ({ req: { user } }) =>
          user?.roles && user?.roles.includes("admin"),
        read: ({ req: { user } }) =>
          user?.roles && user?.roles.includes("admin"),
        update: ({ req: { user } }) =>
          user?.roles && user?.roles.includes("admin"),
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
        read: ({ req: { user } }) =>
          user?.roles && user?.roles.includes("admin"),
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

  return {
    ...existingCollectionConfig,
    fields,
    hooks,
  };
};

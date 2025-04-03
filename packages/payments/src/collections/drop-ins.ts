import type { CollectionConfig } from "payload";
import { PaymentsPluginConfig } from "../types";
import { checkRole } from "@repo/shared-utils";
import { User } from "@repo/shared-types";

export const dropInsCollection = (
  pluginOptions: PaymentsPluginConfig
): CollectionConfig => {
  const config: CollectionConfig = {
    slug: "drop-ins",
    labels: {
      singular: "Drop In",
      plural: "Drop Ins",
    },
    admin: {
      useAsTitle: "name",
      group: "Products",
    },
    access: {
      //read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
      },
      {
        name: "isActive",
        label: "Active",
        type: "checkbox",
        defaultValue: true,
        required: true,
      },
      {
        name: "price",
        label: "Price",
        type: "number",
        required: true,
      },
      {
        name: "adjustable",
        label: "Adjustable",
        type: "checkbox",
        defaultValue: false,
        required: true,
      },
      {
        name: "discountTiers",
        label: "Discount Tiers",
        type: "array",
        fields: [
          {
            name: "minQuantity",
            label: "Min Quantity",
            type: "number",
            min: 1,
            defaultValue: 1,
            required: true,
          },
          {
            name: "discountPercent",
            label: "Discount Percent",
            type: "number",
            min: 0,
            required: true,
          },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: [
              {
                label: "Normal Discount",
                value: "normal",
              },
              {
                label: "Trial Discount (Can only be used on first booking)",
                value: "trial",
              },
            ],
            defaultValue: "normal",
            required: true,
          },
        ],
        validate: (value) => {
          const discountTiers = value as {
            minQuantity: number;
          }[];

          if (!discountTiers) {
            return true;
          }
          // Check for uniqueness of minQuantity
          const quantities = discountTiers.map((tier) => tier.minQuantity);
          const uniqueQuantities = new Set(quantities);
          if (quantities.length !== uniqueQuantities.size) {
            return "Min quantity must be unique across all discount tiers";
          }

          return true;
        },
      },
      {
        name: "paymentMethods",
        label: "Payment Methods",
        type: "select",
        options: pluginOptions.acceptedPaymentMethods || [],
        defaultValue: pluginOptions.acceptedPaymentMethods?.[0]
          ? [pluginOptions.acceptedPaymentMethods[0]]
          : [],
        hasMany: true,
        required: true,
      },
    ],
  };

  return config;
};

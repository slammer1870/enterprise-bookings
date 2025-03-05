import type { CollectionConfig, Config } from "payload";
import { PaymentsPluginConfig } from "../types";

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

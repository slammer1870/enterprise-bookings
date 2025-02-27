import type { CollectionConfig, Config } from "payload";

export const dropInsCollection: CollectionConfig = {
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
      name: "priceType",
      label: "Price Type",
      type: "select",
      options: ["trial", "normal"],
      defaultValue: "normal",
      required: true,
    },

    {
      name: "adjustable",
      label: "Adjustable",
      type: "checkbox",
      defaultValue: false,
      admin: {
        condition: (data) => data?.priceType === "normal",
      },
    },
    {
      name: "discountTiers",
      label: "Discount Tiers",
      type: "array",
      admin: {
        condition: (data) => data?.adjustable,
      },
      fields: [
        {
          name: "minQuantity",
          label: "Min Quantity",
          type: "number",
          required: true,
        },
        {
          name: "discountPercent",
          label: "Discount Percent",
          type: "number",
          required: true,
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data }) => {
        if (
          (data?.priceType === "trial" && data?.adjustable) ||
          (data?.priceType === "trial" && data?.discountTiers)
        ) {
          return false;
        }
      },
    ],
  },
};

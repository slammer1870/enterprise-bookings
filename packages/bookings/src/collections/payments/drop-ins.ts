import type { CollectionConfig } from "payload";

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
      name: "allowedClasses",
      label: "Allowed Classes",
      type: "join",
      collection: "class-options",
      on: "paymentMethods.allowedDropIns",
    },
    {
      name: "active",
      label: "Active",
      type: "checkbox",
      defaultValue: true,
    },
  ],
};

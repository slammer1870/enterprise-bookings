import { CollectionConfig } from "payload";

export const transactionsCollection: CollectionConfig = {
  slug: "transactions",
  admin: {
    useAsTitle: "amount",
    group: "Payments",
  },
  fields: [
    {
      name: "amount",
      type: "number",
      required: true,
    },
    {
      name: "currency",
      type: "select",
      options: ["EUR", "USD"],
      required: true,
    },
    {
      name: "status",
      type: "select",
      options: ["pending", "completed", "failed"],
      required: true,
    },
    {
      name: "paymentMethod",
      type: "select",
      options: ["cash", "card"],
      required: true,
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      required: false,
    },
  ],
};

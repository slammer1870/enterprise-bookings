import { CollectionConfig } from "payload";

import { checkRole } from "@repo/shared-utils";

import { User } from "@repo/shared-types";

export const transactionsCollection: CollectionConfig = {
  slug: "transactions",
  admin: {
    useAsTitle: "amount",
    group: false,
  },
  access: {
    read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
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
      defaultValue: "EUR",
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

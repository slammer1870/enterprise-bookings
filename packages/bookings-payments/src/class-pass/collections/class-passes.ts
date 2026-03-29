import type { CollectionConfig, Field } from "payload";
import {
  classPassReadAccess,
  classPassCreateAccess,
  classPassUpdateAccess,
  classPassDeleteAccess,
} from "../access/class-passes";
import { beforeClassPassChange } from "../hooks/before-class-pass-change";
import type { CollectionOverrides } from "../../types";

const STATUS_OPTIONS = ["active", "expired", "used", "cancelled"] as const;

type ClassPassOpts = {
  classOptionsSlug?: string;
  adminGroup?: string;
  overrides?: CollectionOverrides;
};

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: classPassReadAccess,
  create: classPassCreateAccess,
  update: classPassUpdateAccess,
  delete: classPassDeleteAccess,
};

export function classPassesCollection(opts: ClassPassOpts): CollectionConfig {
  const adminGroup = opts.adminGroup ?? "Billing";
  const overrides = opts.overrides;

  const defaultFields: Field[] = [
    {
      name: "user",
      label: "User",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: { description: "Owner of the class pass" },
    },
    {
      name: "type",
      label: "Pass Type",
      type: "relationship",
      relationTo: "class-pass-types" as import("payload").CollectionSlug,
      required: true,
      admin: { description: "The type of pass (e.g. Fitness Only, Sauna Only)" },
    },
    {
      name: "quantity",
      label: "Remaining quantity",
      type: "number",
      required: true,
      min: 0,
      admin: { description: "Number of passes/credits remaining (original is on the pass type)" },
    },
    {
      name: "expirationDate",
      label: "Expiration date",
      type: "date",
      required: true,
      admin: { description: "Date when passes expire" },
    },
    {
      name: "purchasedAt",
      label: "Purchased at",
      type: "date",
      required: true,
      admin: { description: "When the pass was purchased" },
    },
    {
      name: "price",
      label: "Price (cents)",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description:
          "Price paid for the pass in cents. Auto-filled from the pass type's price when creating.",
      },
    },
    {
      name: "transactionId",
      label: "Transaction ID",
      type: "text",
      required: false,
      admin: {
        description:
          "External transaction id (e.g. Stripe payment intent id).",
      },
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [...STATUS_OPTIONS],
      defaultValue: "active",
      required: true,
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      required: false,
      admin: { description: "Admin notes" },
    },
  ];

  const defaultHooks: NonNullable<CollectionConfig["hooks"]> = {
    beforeChange: [beforeClassPassChange],
    beforeValidate: [
      async ({ data, operation }) => {
        if (operation === "create" && data?.expirationDate) {
          const exp = new Date(data.expirationDate as string);
          if (exp <= new Date()) {
            throw new Error("Expiration date must be in the future");
          }
        }
        return data;
      },
    ],
  };

  const access = overrides?.access
    ? { ...defaultAccess, ...overrides.access }
    : defaultAccess;
  const fields = overrides?.fields
    ? overrides.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const hooks = overrides?.hooks
    ? overrides.hooks({ defaultHooks })
    : defaultHooks;

  return {
    slug: "class-passes",
    labels: { singular: "Class Pass", plural: "Class Passes" },
    admin: {
      useAsTitle: "id",
      defaultColumns: ["user", "tenant", "quantity", "expirationDate", "status"],
      group: adminGroup,
      description: "Class passes / credits for drop-in classes",
    },
    access,
    fields,
    hooks,
  };
}

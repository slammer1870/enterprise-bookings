import type { CollectionConfig, Field } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import {
  classPassTypesReadAccess,
  classPassTypesCreateAccess,
  classPassTypesUpdateAccess,
  classPassTypesDeleteAccess,
} from "../access/class-pass-types";
import { beforeClassPassTypeChange } from "../hooks/before-class-pass-type-change";
import type { CollectionOverrides } from "../../types";

const adminOnlyFieldAccess = {
  read: ({ req: { user } }: { req: { user: unknown } }) => checkRole(["admin"], user as User | null),
  create: ({ req: { user } }: { req: { user: unknown } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }: { req: { user: unknown } }) => checkRole(["admin"], user as User | null),
};

export type ClassPassTypesOpts = {
  adminGroup?: string;
  overrides?: CollectionOverrides;
};

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: classPassTypesReadAccess,
  create: classPassTypesCreateAccess,
  update: classPassTypesUpdateAccess,
  delete: classPassTypesDeleteAccess,
};

const defaultFields: Field[] = [
  {
    name: "name",
    label: "Name",
    type: "text",
    required: true,
    admin: { description: "e.g. Fitness Only, Sauna Only, All Access" },
  },
  {
    name: "slug",
    label: "Slug",
    type: "text",
    required: true,
    unique: true,
    admin: { description: "Unique identifier, e.g. fitness-only, sauna-only" },
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    admin: { description: "Optional description of what this pass type covers" },
  },
  {
    name: "quantity",
    label: "Quantity of passes",
    type: "number",
    required: true,
    min: 1,
    admin: {
      description: "Number of passes/credits in this type (e.g. 10 for a 10-pack). Purchased passes get this many credits.",
    },
  },
  {
    name: "daysUntilExpiration",
    label: "Days until expiration",
    type: "number",
    required: true,
    min: 1,
    defaultValue: 365,
    admin: {
      description:
        "When a pass is purchased, it expires this many calendar days after the purchase date.",
    },
  },
  {
    name: "allowMultipleBookingsPerTimeslot",
    label: "Allow multiple bookings per timeslot",
    type: "checkbox",
    defaultValue: true,
    required: true,
    admin: {
      description: "When enabled, users can use multiple credits from this pass type on the same timeslot (e.g. book 3 spots using 3 credits). When disabled, only one spot per timeslot per user.",
    },
  },
  {
    name: "stripeProductId",
    type: "text",
    label: "Stripe product",
    required: false,
    access: adminOnlyFieldAccess,
    admin: {
      description: "Link to a Stripe product with a one-time default price for purchase/checkout.",
      components: {
        Field: {
          path: "@repo/ui/components/ui/custom-select#CustomSelect",
          clientProps: { apiUrl: "/api/stripe/class-pass-products", dataLabel: "products" },
        },
      },
      position: "sidebar",
    },
  },
  {
    name: "priceInformation",
    label: "Price Information",
    type: "group",
    access: adminOnlyFieldAccess,
    admin: { description: "Price information for the pass type. Synced from Stripe when a product is linked." },
    fields: [
      {
        name: "price",
        type: "number",
        label: "Price (€)",
        admin: { description: "One-time price in euros (from Stripe default price)" },
      },
    ],
  },
  {
    name: "priceJSON",
    type: "textarea",
    access: adminOnlyFieldAccess,
    admin: { hidden: true, readOnly: true, rows: 10 },
    label: "Price JSON",
  },
  {
    name: "status",
    type: "select",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
    defaultValue: "active",
    admin: { description: "Whether this pass type is available for purchase" },
    required: true,
  },
  {
    name: "skipSync",
    type: "checkbox",
    defaultValue: false,
    access: adminOnlyFieldAccess,
    admin: { description: "Skip syncing price/status from Stripe on save" },
    required: false,
  },
];

export function classPassTypesCollection(opts: ClassPassTypesOpts = {}): CollectionConfig {
  const adminGroup = opts.adminGroup ?? "Products";
  const overrides = opts.overrides;
  const access = overrides?.access
    ? { ...defaultAccess, ...overrides.access }
    : defaultAccess;
  const fields = overrides?.fields
    ? overrides.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const defaultHooks: NonNullable<CollectionConfig["hooks"]> = {
    beforeChange: [beforeClassPassTypeChange],
  };
  const hooks = overrides?.hooks
    ? overrides.hooks({ defaultHooks })
    : defaultHooks;

  return {
    slug: "class-pass-types",
    labels: { singular: "Class Pass Type", plural: "Class Pass Types" },
    admin: {
      useAsTitle: "name",
      defaultColumns: ["name", "slug", "quantity", "daysUntilExpiration", "priceInformation.price", "status"],
      group: adminGroup,
      description:
        "Defines pass types (e.g. Fitness Only, Sauna Only). Class options can restrict which types are accepted.",
    },
    access,
    fields,
    hooks,
  };
}

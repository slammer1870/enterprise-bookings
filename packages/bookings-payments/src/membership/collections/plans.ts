import type {
  CollectionAdminOptions,
  CollectionConfig,
  Field,
  Labels,
} from "payload";
import { checkRole } from "@repo/shared-utils";
import type { AccessControls, HooksConfig, User } from "@repo/shared-types";
import { beforeProductChange } from "../hooks/before-product-change";
import type { MembershipBranchConfig } from "../types";

const defaultLabels: Labels = {
  singular: "Membership",
  plural: "Memberships",
};

const defaultAdmin: CollectionAdminOptions = {
  useAsTitle: "name",
  group: "Products",
};

const defaultAccess: AccessControls = {
  read: () => true,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

const defaultFields: Field[] = [
  { name: "name", label: "Name", type: "text", required: true },
  {
    name: "features",
    type: "array",
    label: "Features",
    admin: { description: "Features that are included in this plan" },
    fields: [{ name: "feature", label: "Feature", type: "text" }],
  },
  {
    name: "sessionsInformation",
    label: "Sessions Information",
    type: "group",
    required: false,
    admin: {
      description:
        "Sessions included in this plan (e.g. 10 per month). Important: If a user has e.g. 10 bookings per month, they could book all 10 slots in a single timeslot when allow multiple bookings per timeslot is enabled.",
    },
    fields: [
      {
        type: "row",
        fields: [
          { name: "sessions", label: "Sessions", type: "number", required: false },
          { name: "intervalCount", label: "Per", type: "number", required: false },
          {
            name: "interval",
            label: "Interval",
            type: "select",
            options: [
              { label: "Days", value: "day" },
              { label: "Weeks", value: "week" },
              { label: "Months", value: "month" },
              { label: "Quarters", value: "quarter" },
              { label: "Years", value: "year" },
            ],
            required: false,
          },
        ],
      },
      {
        name: "allowMultipleBookingsPerTimeslot",
        label: "Allow multiple bookings per timeslot",
        type: "checkbox",
        defaultValue: false,
        required: true,
        admin: {
          description:
            "When enabled, subscribers can use multiple session credits on the same timeslot (e.g. book 10 spots in one class if they have 10 sessions per month). When disabled, only one spot per timeslot per user.",
        },
      },
    ],
  },
  {
    name: "stripeProductId",
    type: "text",
    label: "Stripe Plan",
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    admin: {
      components: {
        Field: {
          path: "@repo/ui/components/ui/custom-select#CustomSelect",
          clientProps: { apiUrl: `/api/stripe/plans`, dataLabel: "products" },
        },
      },
      position: "sidebar",
    },
  },
  {
    name: "priceInformation",
    label: "Price Information",
    admin: { description: "Price information for the plan" },
    type: "group",
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "price",
            type: "number",
            label: "Price (€)",
            admin: { description: "Price of the plan" },
          },
          {
            name: "intervalCount",
            type: "number",
            label: "Per",
            admin: { description: "Number of intervals per period" },
          },
          {
            name: "interval",
            type: "select",
            label: "Interval",
            options: [
              { label: "Day", value: "day" },
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "Year", value: "year" },
            ],
            defaultValue: "month",
            admin: { description: "How often the price is charged" },
          },
        ],
      },
    ],
  },
  {
    name: "priceJSON",
    type: "textarea",
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    admin: { hidden: true, readOnly: true, rows: 10 },
    label: "Price JSON",
  },
  {
    name: "status",
    type: "select",
    options: ["active", "inactive"],
    defaultValue: "active",
    admin: { description: "Status of the plan" },
    required: true,
  },
  {
    name: "skipSync",
    type: "checkbox",
    defaultValue: false,
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    admin: { description: "Skip syncing to Stripe" },
    required: false,
  },
];

const defaultHooks: HooksConfig = {
  beforeChange: [beforeProductChange],
};

export function generatePlansCollection(
  config: MembershipBranchConfig
): CollectionConfig {
  const overrides = config?.plansOverrides;
  return {
    ...(overrides ?? {}),
    slug: "plans",
    defaultSort: "priceInformation.price",
    labels: { ...(overrides?.labels ?? defaultLabels) },
    access: {
      ...(defaultAccess as NonNullable<CollectionConfig["access"]>),
      ...(overrides?.access ?? {}),
    },
    admin: {
      ...defaultAdmin,
      ...(overrides?.admin ?? {}),
    },
    hooks: {
      ...(overrides?.hooks &&
      typeof overrides.hooks === "function"
        ? overrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      overrides?.fields && typeof overrides.fields === "function"
        ? overrides.fields({ defaultFields })
        : defaultFields,
  };
}

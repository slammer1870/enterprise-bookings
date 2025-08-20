import type {
  CollectionAdminOptions,
  CollectionConfig,
  Field,
  Labels,
} from "payload";

import { checkRole } from "@repo/shared-utils";

import { beforeProductChange } from "../hooks/before-product-change";

import { AccessControls, HooksConfig, User } from "@repo/shared-types";

import type { MembershipsPluginConfig } from "../types";

const defaultLabels: Labels = {
  singular: "Plan",
  plural: "Plans",
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
  {
    name: "name",
    label: "Name",
    type: "text",
    required: true,
  },
  {
    name: "features",
    type: "array",
    label: "Features",
    admin: {
      description: "Features that are included in this plan",
    },
    fields: [
      {
        name: "feature",
        label: "Feature",
        type: "text",
      },
    ],
  },
  {
    name: "sessionsInformation",
    label: "Sessions Information",
    type: "group",
    required: false,
    admin: {
      description: "Sessions included in this plan (if applicable)",
    },
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "sessions",
            label: "Sessions",
            type: "number",
            required: false,
          },
          {
            name: "intervalCount",
            label: "Per",
            type: "number",
            required: false,
          },
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
    ],
  },
  {
    name: "stripeProductId",
    type: "text",
    label: "Stripe Plan",
    admin: {
      components: {
        Field: {
          path: "@repo/ui/components/ui/custom-select#CustomSelect",
          clientProps: {
            apiUrl: `/api/stripe/plans`,
            dataLabel: "products",
          },
        },
      },
      position: "sidebar",
    },
  },
  {
    name: "priceInformation",
    label: "Price Information",
    admin: {
      description: "Price information for the plan",
    },
    type: "group",
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "price",
            type: "number",
            label: "Price (€)",
            admin: {
              description: "Price of the plan",
            },
          },
          {
            name: "intervalCount",
            type: "number",
            label: "Per",
            admin: {
              description: "Number of intervals per period",
            },
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
            admin: {
              description: "How often the price is charged",
            },
          },
        ],
      },
    ],
  },
  {
    name: "priceJSON",
    type: "textarea",
    admin: {
      hidden: true,
      readOnly: true,
      rows: 10,
    },
    label: "Price JSON",
  },
  {
    name: "status",
    type: "select",
    options: ["active", "inactive"],
    defaultValue: "active",
    admin: {
      description: "Status of the plan",
    },
    required: true,
  },
  {
    name: "skipSync",
    type: "checkbox",
    defaultValue: false,
    admin: {
      description: "Skip syncing to Stripe",
    },
    required: false,
  },
];

const defaultHooks: HooksConfig = {
  beforeChange: [beforeProductChange],
};

export const generatePlansCollection = (config: MembershipsPluginConfig) => {
  const plansConfig: CollectionConfig = {
    ...(config?.plansOverrides || {}),
    slug: "plans",
    labels: {
      ...(config?.plansOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.plansOverrides?.access || defaultAccess),
    },
    admin: {
      ...(config?.plansOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.plansOverrides?.hooks &&
      typeof config?.plansOverrides?.hooks === "function"
        ? config.plansOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      config?.plansOverrides?.fields &&
      typeof config?.plansOverrides?.fields === "function"
        ? config.plansOverrides.fields({ defaultFields })
        : defaultFields,
  };

  return plansConfig;
};

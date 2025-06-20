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
  read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
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
    type: "row",
    fields: [
      {
        name: "sessions",
        label: "Sessions",
        type: "number",
        admin: {
          description: "Number of sessions included in this plan",
        },
      },
      {
        name: "intervalCount",
        label: "Per",
        type: "number",
        admin: {
          description: "Number of sessions per interval",
        },
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
        admin: {
          description: "How often the sessions are included",
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
    },
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
    name: "priceJSON",
    type: "textarea",
    admin: {
      hidden: false,
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

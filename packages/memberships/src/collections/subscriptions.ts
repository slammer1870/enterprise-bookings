import {
  CollectionAdminOptions,
  CollectionConfig,
  CollectionSlug,
  Field,
  Labels,
} from "payload";

import { checkRole } from "@repo/shared-utils";

import { User, HooksConfig, AccessControls } from "@repo/shared-types";

import { beforeSubscriptionChange } from "../hooks/before-subscription-change";

import { MembershipsPluginConfig } from "../types";

import { AccessControls, HooksConfig } from "@repo/shared-types";

import { isAdminOrOwner } from "@repo/shared-services/src/access/is-admin-or-owner";

const defaultFields: Field[] = [
  {
    name: "user",
    type: "relationship",
    relationTo: "users" as CollectionSlug,
    required: true,
  },
  {
    name: "plan",
    type: "relationship",
    relationTo: "plans" as CollectionSlug,
    required: true,
  },
  {
    name: "status",
    type: "select",
    // Statuses: active, canceled, paused use American spelling
    options: [
      "incomplete",
      "incomplete_expired",
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
    ],
    required: true,
    defaultValue: "incomplete",
  },
  {
    type: "row",
    fields: [
      {
        name: "startDate",
        type: "date",
        admin: {
          date: {
            pickerAppearance: "dayOnly",
          },
        },
      },
      {
        name: "endDate",
        type: "date",
        admin: {
          date: {
            pickerAppearance: "dayOnly",
          },
        },
      },
      {
        name: "cancelAt",
        type: "date",
        admin: {
          date: {
            pickerAppearance: "dayOnly",
          },
        },
        required: false,
      },
    ],
  },
  {
    name: "stripeSubscriptionId",
    type: "text",
    label: "Stripe Subscription ID",
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    unique: true,
    required: false,
    admin: {
      components: {
        Field: {
          path: "@repo/ui/components/ui/custom-select#CustomSelect",
          clientProps: {
            apiUrl: `/api/stripe/subscriptions`,
            dataLabel: "subscriptions",
          },
        },
      },
      position: "sidebar",
    },
    hooks: {},
  },
];

const defaultLabels: Labels = {
  singular: "Subscription",
  plural: "Subscriptions",
};

const defaultAccess: AccessControls = {
  read: isAdminOrOwner,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Billing",
  useAsTitle: "user",
};

const defaultHooks: HooksConfig = {
  beforeChange: [beforeSubscriptionChange],
};

export const generateSubscriptionCollection = (
  config: MembershipsPluginConfig
) => {
  const subscriptionConfig: CollectionConfig = {
    ...(config?.subscriptionOverrides || {}),
    slug: "subscriptions",
    labels: {
      ...(config?.subscriptionOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.subscriptionOverrides?.access || defaultAccess),
    },
    admin: {
      ...(config?.subscriptionOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.subscriptionOverrides?.hooks &&
      typeof config?.subscriptionOverrides?.hooks === "function"
        ? config.subscriptionOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      config?.subscriptionOverrides?.fields &&
      typeof config?.subscriptionOverrides?.fields === "function"
        ? config.subscriptionOverrides.fields({ defaultFields })
        : defaultFields,
  };

  return subscriptionConfig;
};

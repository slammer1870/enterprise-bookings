import type {
  CollectionAdminOptions,
  CollectionConfig,
  CollectionSlug,
  Field,
  Labels,
} from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User, HooksConfig, AccessControls } from "@repo/shared-types";
import { isAdminOrOwner } from "@repo/shared-services";
import { beforeSubscriptionChange } from "../hooks/before-subscription-change";
import type { MembershipBranchConfig } from "../types";

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
    relationTo: "memberships" as CollectionSlug,
    required: true,
  },
  {
    name: "status",
    type: "select",
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
        admin: { date: { pickerAppearance: "dayOnly" } },
      },
      {
        name: "endDate",
        type: "date",
        admin: { date: { pickerAppearance: "dayOnly" } },
      },
      {
        name: "cancelAt",
        type: "date",
        admin: { date: { pickerAppearance: "dayOnly" } },
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
    unique: false,
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
  {
    name: "skipSync",
    type: "checkbox",
    defaultValue: false,
    admin: { description: "Skip syncing to Stripe" },
    required: false,
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
  useAsTitle: "stripeSubscriptionId",
  components: {
    beforeListTable: ["@repo/bookings-payments#SyncStripe"],
  },
};

const defaultHooks: HooksConfig = {
  beforeChange: [beforeSubscriptionChange],
};

export function generateSubscriptionCollection(
  config: MembershipBranchConfig
): CollectionConfig {
  const overrides = config?.subscriptionOverrides;
  return {
    ...(overrides ?? {}),
    slug: "subscriptions",
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

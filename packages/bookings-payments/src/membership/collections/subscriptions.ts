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
import { createBeforeSubscriptionChange } from "../hooks/before-subscription-change";
import type { MembershipBranchConfig } from "../types";

function isConnectLikeScope(scope: unknown): boolean {
  return scope === "connect" || scope === "auto";
}

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
      read: ({ req: { user } }) => checkRole(["super-admin", "admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["super-admin", "admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["super-admin", "admin"], user as User | null),
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
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
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

function getDefaultAdmin(config: MembershipBranchConfig): CollectionAdminOptions {
  const beforeListTable: string[] =
    config.syncStripeSubscriptions === true
      ? ["@repo/bookings-payments#SyncStripe"]
      : [];
  return {
    group: "Billing",
    useAsTitle: "stripeSubscriptionId",
    // List search: nested paths on the `user` relationship (see Payload listSearchableFields docs).
    // Omit Stripe audit IDs (stripeCustomerId, stripeAccountId, stripeSubscriptionId) from search.
    listSearchableFields: ["id", "user.email", "user.name", "status"],
    components: {
      beforeListTable,
    },
  };
}

export function generateSubscriptionCollection(
  config: MembershipBranchConfig
): CollectionConfig {
  const overrides = config?.subscriptionOverrides;
  const connectAuditFields: Field[] = [
    {
      name: "stripeAccountId",
      type: "text",
      label: "Stripe Account ID (Connect)",
      access: {
        read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
        create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
        update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      },
      required: false,
      admin: {
        position: "sidebar",
        readOnly: true,
        disableListFilter: true,
        condition: (_, siblingData) => Boolean((siblingData as any)?.stripeAccountId),
      },
    },
    {
      name: "stripeCustomerId",
      type: "text",
      label: "Stripe Customer ID (Connect)",
      access: {
        read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
        create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
        update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      },
      required: false,
      admin: {
        position: "sidebar",
        readOnly: true,
        disableListFilter: true,
        condition: (_, siblingData) => Boolean((siblingData as any)?.stripeCustomerId),
      },
    },
  ];
  const defaultHooks: HooksConfig = {
    beforeChange: [
      createBeforeSubscriptionChange({
        getStripeAccountIdForRequest: config.getStripeAccountIdForRequest,
        scope: config.scope,
      }),
    ],
  };
  return {
    ...(overrides ?? {}),
    slug: "subscriptions",
    labels: { ...(overrides?.labels ?? defaultLabels) },
    access: {
      ...(defaultAccess as NonNullable<CollectionConfig["access"]>),
      ...(overrides?.access ?? {}),
    },
    admin: {
      ...getDefaultAdmin(config),
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
        ? overrides.fields({
            defaultFields: isConnectLikeScope(config.scope)
              ? [...defaultFields, ...connectAuditFields]
              : defaultFields,
          })
        : isConnectLikeScope(config.scope)
          ? [...defaultFields, ...connectAuditFields]
          : defaultFields,
  };
}

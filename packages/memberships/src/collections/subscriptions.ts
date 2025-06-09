import { CollectionConfig, CollectionSlug } from "payload";

import { checkRole } from "@repo/shared-utils";

import { User } from "@repo/shared-types";

import { beforeSubscriptionChange } from "../hooks/before-subscription-change";

export const subscriptionsCollection: CollectionConfig = {
  slug: "subscriptions",
  admin: {
    useAsTitle: "user",
    group: "Billing",
  },
  fields: [
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
      hooks: {
        beforeChange: [
          ({ value, siblingData, originalDoc, operation }) => {
            if (!siblingData.user) {
              return new Error(
                "User is required to select a subscription in stripe"
              );
            }

            if (
              operation === "update" &&
              originalDoc.user !== siblingData.user
            ) {
              value = null;
              return value;
            }
          },
        ],
      },
    },
  ],
  hooks: {
    beforeChange: [beforeSubscriptionChange],
  },
};

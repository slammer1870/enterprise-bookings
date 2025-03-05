import type { CollectionConfig } from "payload";

import { checkRole } from "@repo/shared-utils";

import { beforeProductChange } from "../hooks/before-product-change";

import { User } from "@repo/shared-types";

export const plansCollection: CollectionConfig = {
  slug: "plans",
  labels: {
    singular: "Plan",
    plural: "Plans",
  },
  admin: {
    useAsTitle: "name",
    group: "Products",
  },
  fields: [
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
              dataLabel: "plan",
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
        hidden: true,
        readOnly: true,
        rows: 10,
      },
      label: "Price JSON",
    },
  ],
  hooks: {
    beforeChange: [beforeProductChange],
  },
};

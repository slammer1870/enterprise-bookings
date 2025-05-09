import { Field } from "payload";

import { checkRole } from "@repo/shared-utils";

import { User } from "@repo/shared-types";

export const stripeCustomerId: Field = {
  name: "stripeCustomerId",
  type: "text",
  label: "Stripe Customer",
  defaultValue: "",
  access: {
    read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  },
  admin: {
    components: {
      Field: {
        path: "@repo/ui/components/ui/custom-select#CustomSelect",
        clientProps: {
          apiUrl: `/api/stripe/customers`,
          dataLabel: "customers",
        },
      },
    },
    position: "sidebar",
  },
};

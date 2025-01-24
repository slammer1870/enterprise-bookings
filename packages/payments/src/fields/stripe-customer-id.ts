import { Field } from "payload";

import { checkRole } from "@repo/roles/src/check-role";

export const stripeCustomerId: Field = {
  name: "stripeCustomerId",
  type: "text",
  label: "Stripe Customer",
  access: {
    read: ({ req: { user } }) => checkRole(["admin"], user as any),
  },
  admin: {
    components: {
      Field: {
        path: "@repo/ui/src/components/ui/custom-select#CustomSelect",
        clientProps: {
          apiUrl: `/api/stripe/customers`,
          dataLabel: "customer",
        },
      },
    },
    position: "sidebar",
  },
};

import type { Field } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

export const stripeCustomerId: Field = {
  name: "stripeCustomerId",
  type: "text",
  label: "Stripe Customer",
  defaultValue: "",
  access: {
    read: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
    update: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
    create: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
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
  saveToJWT: false,
};

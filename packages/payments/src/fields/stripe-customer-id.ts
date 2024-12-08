import { Field } from "payload";
import { checkRole } from "@repo/roles/src/check-role";

export const StripeCustomerId: Field = {
  name: "stripeCustomerId",
  type: "text",
  label: "Stripe Customer",
  access: {
    read: ({ req: { user } }) => checkRole(["admin"], user as any),
  },
  admin: {
    components: {
      Field: "@repo/payments/src/components/customer-select#CustomerSelect",
    },
    position: "sidebar",
  },
};

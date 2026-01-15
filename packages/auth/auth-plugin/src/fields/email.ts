import { checkRole } from "@repo/shared-utils";
import { Field } from "payload";
import { User } from "@repo/shared-types";

export const email: Field = {
  name: "email",
  label: "Email",
  type: "text",
  required: true,
  unique: true,
  access: {
    read: ({ req: { user }, siblingData }) => {
      if (checkRole(["admin"], user as unknown as User)) {
        return true;
      }

      if (siblingData?.id === user?.id) {
        return true;
      }

      if (siblingData?.parent && siblingData?.parent === user?.id) {
        return true;
      }

      return false;
    },
  },
};

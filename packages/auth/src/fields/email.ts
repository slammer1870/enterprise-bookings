import { checkRole } from "@repo/shared-utils";
import { Field } from "payload";

export const email: Field = {
  name: "email",
  label: "Email",
  type: "text",
  required: true,
  unique: true,
  access: {
    read: ({ req: { user }, siblingData }) => {
      console.log("FIELD ACCESS", siblingData);
      console.log("USER", user);

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

import { checkRole } from "../check-role";
import { Field } from "payload";
import { ensureFirstUserIsAdmin } from "../hooks/create-first-admin";

export const roles: Field = {
  name: "roles",
  type: "select",
  access: {
    create: ({ req: { user } }) => checkRole(["admin"], user as any),
    read: ({ req: { user } }) => checkRole(["admin"], user as any),
    update: ({ req: { user } }) => checkRole(["admin"], user as any),
  },
  defaultValue: ["customer"],
  hasMany: true,
  hooks: {
    beforeChange: [ensureFirstUserIsAdmin],
  },
  options: [
    {
      label: "admin",
      value: "admin",
    },
    {
      label: "customer",
      value: "customer",
    },
  ],
};

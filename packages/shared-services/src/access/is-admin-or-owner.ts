import { Access } from "payload";
import { User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";

export const isAdminOrOwner: Access = ({ req }) => {
  const { user } = req;

  if (!user) {
    return false;
  }

  if (checkRole(["admin"], user as unknown as User | null)) {
    return true;
  }

  return {
    user: {
      equals: user.id,
    },
  };
};

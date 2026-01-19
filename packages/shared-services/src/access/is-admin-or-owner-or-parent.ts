import { Access, Where } from "payload";
import { User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";

export const isAdminOrOwnerOrParent: Access = ({ req }) => {
  const { user } = req;

  if (!user) {
    return false;
  }

  if (checkRole(["admin"], user as unknown as User | null)) {
    return true;
  }

  return {
    or: [
      {
        user: {
          equals: user.id,
        },
      },
      {
        "user.parentUser": {
          equals: user.id,
        },
      },
    ],
  } as Where;
};

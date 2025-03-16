import type { Access } from "payload";
import type { User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

export const adminOrUser: Access = ({ req: { user } }) => {
  if (user && checkRole(["admin"], user as unknown as User)) {
    return true;
  }

  return {
    id: {
      equals: user?.id,
    },
  };
};

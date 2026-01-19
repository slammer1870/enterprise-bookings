import type { Access, Where } from "payload";
import type { User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

export const isBookingAdminOrParentOrOwner: Access = ({
  req: { user },
  id,
}) => {
  if (!user) {
    return false;
  }

  if (user && checkRole(["admin"], user as unknown as User)) {
    return true;
  }

  return {
    or: [
      {
        "user.id": {
          equals: user?.id,
        },
      },
      {
        "user.parentUser": {
          equals: user?.id,
        },
      },
    ],
  } as Where;
};

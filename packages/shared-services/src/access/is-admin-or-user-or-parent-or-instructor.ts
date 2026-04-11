import type { Access, Where } from "payload";
import type { User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

export const adminOrUserOrParentOrStaffMember: Access = ({
  req: { user },
  id: _id,
}) => {
  // Allow unauthenticated users to see staffMembers only
  if (!user) {
    return {
      "timeslots.instructor": {
        exists: true,
      },
    } as Where;
  }

  if (user && checkRole(["admin"], user as unknown as User)) {
    return true;
  }

  const userForQuery = user && typeof user === "object" ? user?.id : user;

  return {
    or: [
      {
        "timeslots.instructor": {
          exists: true,
        },
      },
      {
        parentUser: {
          equals: userForQuery,
        },
      },
      {
        id: {
          equals: userForQuery,
        },
      },
    ],
  } as Where;
};

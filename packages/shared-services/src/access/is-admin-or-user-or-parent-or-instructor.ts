import type { Access, Where } from "payload";
import type { User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

export const adminOrUserOrParentOrInstructor: Access = ({
  req: { user },
  id,
}) => {
  if (user && checkRole(["admin"], user as unknown as User)) {
    return true;
  }

  const userForQuery = user && typeof user === "object" ? user?.id : user;

  return {
    or: [
      {
        "lessons.instructor": {
          exists: true,
        },
      },
      {
        parent: {
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

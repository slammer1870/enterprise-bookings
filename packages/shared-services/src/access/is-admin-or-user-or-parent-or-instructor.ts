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

  return {
    or: [
      {
        "lessons.instructor": {
          exists: true,
        },
      },
      {
        parent: {
          equals: user?.id,
        },
      },
      {
        id: {
          equals: user?.id,
        },
      },
    ],
  } as Where;
};

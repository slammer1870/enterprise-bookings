import type { Access, Where } from "payload";
import type { User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

export const adminOrUserOrInstructor: Access = ({ req: { user }, id }) => {
  if (user && checkRole(["admin"], user as unknown as User)) {
    return true;
  }

  if (id) {
    return {
      id: {
        equals: user?.id,
      },
    };
  }

  return {
    or: [
      {
        "lessons.instructor": {
          exists: true,
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

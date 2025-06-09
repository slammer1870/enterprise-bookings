import { User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";
import { Access } from "payload";

export const lessonReadAccess: Access = ({ req: { user } }) => {
  if (checkRole(["admin"], user as User | null)) return true;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return {
    startTime: {
      less_than: new Date(new Date().setDate(new Date().getDate() + 30)),
      greater_than: startOfToday,
    },
  };
};

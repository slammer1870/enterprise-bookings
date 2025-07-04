import { User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";
import { Access } from "payload";

export const lessonReadAccess: Access = ({ req: { user } }) => {
  if (checkRole(["admin"], user as User | null)) return true;

  // If user is authenticated, allow them to see all lessons
  // The frontend or API layer can handle filtering for instructors
  if (user) return true;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // For unauthenticated users, only show lessons within date range
  return {
    startTime: {
      less_than: new Date(new Date().setDate(new Date().getDate() + 30)),
      greater_than: startOfToday,
    },
  };
};

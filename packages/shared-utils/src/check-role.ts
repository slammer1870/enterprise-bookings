import type { User } from "@repo/shared-types/";

import { getEffectiveUserRoles } from "./effective-user-roles";

export const checkRole = (
  allRoles: User["roles"] = [],
  user: User | null
): boolean => {
  if (!user) return false;
  const effective = getEffectiveUserRoles(user);
  return allRoles.some((role) => effective.includes(role));
};

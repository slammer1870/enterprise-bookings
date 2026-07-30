import type { Access } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

export const courseEnrollmentsReadAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (checkRole(["admin"], user as unknown as User)) return true;
  return { user: { equals: user.id } };
};

export const courseEnrollmentsCreateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};

export const courseEnrollmentsUpdateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};

export const courseEnrollmentsDeleteAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};

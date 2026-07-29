import type { Access } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

export const coursesReadAccess: Access = () => true;
export const coursesCreateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};
export const coursesUpdateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};
export const coursesDeleteAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};

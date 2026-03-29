import type { Access } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

export const classPassTypesReadAccess: Access = () => true;
export const classPassTypesCreateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};
export const classPassTypesUpdateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};
export const classPassTypesDeleteAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  return checkRole(["admin"], user as unknown as User);
};

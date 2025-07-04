import { checkRole } from "@repo/shared-utils";
import { User } from "@repo/shared-types";
import { AccessArgs } from "payload";

export const isAdminOrUserOrInstructor = async ({
  req,
  id,
  data,
}: AccessArgs<User>) => {
  const user = req.user as User | null;

  console.log("READING DATA", data);
  console.log("READING ID", id);

  if (checkRole(["admin"], user as User)) return true;

  if (id && id === user?.id) return true;

  return false;
};

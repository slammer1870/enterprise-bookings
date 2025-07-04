import { checkRole } from "@repo/shared-utils";
import { User } from "@repo/shared-types";
import { AccessArgs } from "payload";

export const isAdminOrUserOrInstructor = async ({
  req,
  id,
}: AccessArgs<User>) => {
  const user = req.user as User | null;

  if (checkRole(["admin"], user as User)) return true;

  if (id && id === user?.id) return true;

  if (id) {
    const lesson = await req.payload.find({
      collection: "lessons",
      where: {
        instructor: {
          equals: id,
        },
      },
    });

    if (lesson.docs.length > 0) return true;
  }

  return false;
};

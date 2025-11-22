import { protectedProcedure, requireCollections } from "../trpc";
import { z } from "zod";
import { generatePasswordSaltHash } from "@repo/shared-utils";
import crypto from "crypto";
import { findSafe, createSafe } from "../utils/collections";

import { User } from "@repo/shared-types";

export const usersRouter = {
  getChildren: protectedProcedure
    .use(requireCollections("users"))
    .query(async ({ ctx }) => {
      const children = await findSafe(ctx.payload, "users", {
      where: {
        parent: { equals: ctx.user?.id },
      },
      limit: 100,
      depth: 1,
      sort: "name",
        overrideAccess: false,
        user: ctx.user,
    });

    return children.docs;
  }),
  createChild: protectedProcedure
    .use(requireCollections("users"))
    .input(
      z.object({
        name: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const { hash, salt } = await generatePasswordSaltHash({
        password: randomPassword,
      });
      const child = await createSafe(ctx.payload, "users", {
          name: input.name,
          email: input.email,
          parent: ctx.user?.id,
          hash,
          salt,
          password: randomPassword,
      }, {
        overrideAccess: false,
        user: ctx.user,
      });

      return child as User;
    }),
};

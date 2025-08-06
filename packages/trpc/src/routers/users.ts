import { protectedProcedure } from "../trpc";
import { z } from "zod";
import { generatePasswordSaltHash } from "@repo/shared-utils";
import crypto from "crypto";

export const usersRouter = {
  getChildren: protectedProcedure.query(async ({ ctx }) => {
    const children = await ctx.payload.find({
      collection: "users",
      where: {
        parent: { equals: ctx.user?.id },
      },
      limit: 100,
      depth: 1,
      sort: "name",
    });

    return children.docs;
  }),
  createChild: protectedProcedure
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
      const child = await ctx.payload.create({
        collection: "users",
        data: {
          name: input.name,
          email: input.email,
          parent: ctx.user?.id,
          hash,
          salt,
          password: randomPassword,
        },
      });

      return child;
    }),
};

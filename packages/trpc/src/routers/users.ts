import { protectedProcedure, requireCollections } from "../trpc";
import { z } from "zod";
import { checkRole, generatePasswordSaltHash } from "@repo/shared-utils";
import crypto from "crypto";
import { findSafe, createSafe } from "../utils/collections";
import { TRPCError } from "@trpc/server";

import { User } from "@repo/shared-types";

export const usersRouter = {
  listForKiosk: protectedProcedure
    .use(requireCollections("users"))
    .query(async ({ ctx }) => {
      if (!checkRole(["admin"], ctx.user as any)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const users = await findSafe(ctx.payload, "users", {
        limit: 0,
        depth: 1,
        sort: "name",
        overrideAccess: false,
        user: ctx.user,
      });

      return users.docs as User[];
    }),
  getChildren: protectedProcedure
    .use(requireCollections("users"))
    .query(async ({ ctx }) => {
      const children = await findSafe(ctx.payload, "users", {
        where: {
          parentUser: { equals: ctx.user?.id },
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
        parentUser: ctx.user?.id,
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

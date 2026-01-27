import { publicProcedure } from "../trpc";
import { z } from "zod";
import { generatePasswordSaltHash } from "@repo/shared-utils";
import crypto from "crypto";
import { findSafe, createSafe } from "../utils/collections";
import { TRPCError } from "@trpc/server";

export const authRouter = {
  getSession: publicProcedure.query(async ({ ctx }) => {
    // Prefer Better Auth session when configured (magic-link login uses this).
    if (ctx.betterAuth?.api?.getSession) {
      const session = await ctx.betterAuth.api.getSession({ headers: ctx.headers });
      return session?.user ? session : null;
    }

    const session = await ctx.payload.auth({ headers: ctx.headers, canSetHeaders: false });
    return session?.user ? session : null;
  }),
  registerPasswordless: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already exists
      const existingUser = await findSafe(ctx.payload, "users", {
        where: {
          email: {
            equals: input.email.toLowerCase(),
          },
        },
        limit: 1,
        overrideAccess: true,
      });

      if (existingUser.docs.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User already exists",
        });
      }

      // Generate a random password for passwordless registration
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const { hash, salt } = await generatePasswordSaltHash({
        password: randomPassword,
      });

      // Create the user
      const user = await createSafe(
        ctx.payload,
        "users",
        {
          name: input.name,
          email: input.email.toLowerCase(),
          hash: hash,
          salt: salt,
          password: randomPassword,
        },
        {
          overrideAccess: true, // Allow creating users without authentication
          depth: 0, // Don't populate relationships to avoid processing join fields
        }
      );

      return user;
    }),
  signInMagicLink: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        callbackURL: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();

      const user = await findSafe(ctx.payload, "users", {
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      });

      if (!user.docs.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User not found" });
      }

      if (!ctx.betterAuth)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Better Auth plugin is not configured.",
        });

      await ctx.betterAuth.api.signInMagicLink({
        body: {
          email: email, // required
          callbackURL: input.callbackURL,
        },
        headers: ctx.headers,
      });

      return { success: true };
    }),
};

import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import {
  protectedProcedure,
  publicProcedure,
  requireCollections,
} from "../trpc";
import { findByIdSafe, findSafe } from "../utils/collections";

import { ClassOption, Lesson } from "@repo/shared-types";
import { checkRole, getDayRange } from "@repo/shared-utils";

export const lessonsRouter = {
  getById: protectedProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        input.id,
        {
          depth: 3,
          overrideAccess: false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      return lesson;
    }),

  getByIdForChildren: protectedProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const lesson = await findByIdSafe<Lesson>(
          ctx.payload,
          "lessons",
          input.id,
          {
            depth: 2,
            overrideAccess: false,
            user: ctx.user,
          }
        );

        if (!lesson) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Lesson with id ${input.id} not found`,
          });
        }

        // Fetch classOption separately to avoid relationship depth issues
        const classOption = lesson.classOption as ClassOption;
        // Validate that the class option has type 'child'
        if (!classOption || classOption.type !== "child") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This lesson is not available for children bookings. Only lessons with child class options are allowed.",
          });
        }

        return lesson;
      } catch (error) {
        console.error("Error in getByIdForChildren:", error);
        throw error;
      }
    }),

  getByDate: publicProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const { user } = await ctx.payload.auth({
          headers: ctx.headers,
        });

        const startOfDay = new Date(input.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(input.date);
        endOfDay.setHours(23, 59, 59, 999);

        const queryOptions: {
          where: any;
          depth: number;
          sort: string;
          overrideAccess: boolean;
          user?: any;
        } = {
          where: {
            startTime: {
              greater_than_equal: startOfDay.toISOString(),
              less_than_equal: endOfDay.toISOString(),
            },
          },
          depth: 2,
          sort: "startTime",
          overrideAccess: false,
        };

        if (user) {
          queryOptions.user = user;
        }

        const lessons = await findSafe(ctx.payload, "lessons", queryOptions);

        return lessons.docs.map((lesson: any) => lesson as Lesson);
      } catch (error) {
        console.error("Error in getByDate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch lessons",
          cause: error,
        });
      }
    }),
  getForKiosk: protectedProcedure
    .use(requireCollections("lessons"))
    .query(async ({ ctx }) => {
      if (!checkRole(["admin"], ctx.user as any)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const { endOfDay } = getDayRange(new Date());

      const lessons = await findSafe(ctx.payload, "lessons", {
        where: {
          and: [
            {
              startTime: {
                less_than_equal: endOfDay,
              },
            },
            {
              endTime: {
                greater_than_equal: new Date().toISOString(),
              },
            },
            { active: { equals: true } },
          ],
        },
        sort: "startTime",
        depth: 2,
        limit: 0,
        overrideAccess: false,
        user: ctx.user,
      });

      return lessons.docs.map((lesson: any) => lesson as Lesson);
    }),
} satisfies TRPCRouterRecord;

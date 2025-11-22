import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure, publicProcedure, requireCollections } from "../trpc";
import { findByIdSafe, findSafe } from "../utils/collections";

import { ClassOption, Lesson } from "@repo/shared-types";

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

        const lessons = await ctx.payload.find({
          collection: "lessons",
          where: {
            startTime: {
              greater_than_equal: startOfDay.toISOString(),
              less_than_equal: endOfDay.toISOString(),
            },
          },
          depth: 2,
          sort: "startTime",
          overrideAccess: false,
          user: user || undefined,
        });

        return lessons.docs.map((lesson: any) => lesson as Lesson);
      } catch (error) {
        console.error("Error in getByDate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch lessons",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;

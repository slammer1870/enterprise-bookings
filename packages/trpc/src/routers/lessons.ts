import { z } from "zod";

import { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../trpc";

import { Lesson } from "@repo/shared-types";

export const lessonsRouter = {
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }): Promise<Lesson> => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 2,
        overrideAccess: false,
      });

      return lesson as Lesson;
    }),

  getByDate: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }): Promise<Lesson[]> => {
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
        overrideAccess: false,
      });

      return lessons.docs.map((lesson) => lesson as Lesson);
    }),
} satisfies TRPCRouterRecord;

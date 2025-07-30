import { z } from "zod";

import { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../trpc";

// Type for lesson with populated relationships (depth 2)
type LessonWithRelations = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  lockOutTime: number;
  location?: string | null;
  instructor?: {
    id: number;
    email: string;
    name?: string;
    // Add other User fields as needed
  } | null;
  classOption: {
    id: number;
    name: string;
    places: number;
    description?: string;
    type: string;
    paymentMethods?: {
      allowedPlans: any[];
      allowedDropIn: any;
    };
    // Add other ClassOption fields as needed
  };
  bookings?: {
    docs: any[];
    hasNextPage: boolean;
    totalDocs?: number;
  };
  remainingCapacity?: number | null;
  bookingStatus?: string | null;
  active?: boolean | null;
  originalLockOutTime?: number | null;
  updatedAt: string;
  createdAt: string;
};

export const lessonsRouter = {
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }): Promise<LessonWithRelations> => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 2,
      });

      return lesson as LessonWithRelations;
    }),

  getByDate: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }): Promise<LessonWithRelations[]> => {
      const lessons = await ctx.payload.find({
        collection: "lessons",
        where: {
          date: {
            equals: input.date,
          },
        },
        depth: 2,
      });

      return lessons.docs.map((lesson) => lesson as LessonWithRelations);
    }),
} satisfies TRPCRouterRecord;

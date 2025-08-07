import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure, publicProcedure } from "../trpc";

import { ClassOption, Lesson, Subscription } from "@repo/shared-types";

export const lessonsRouter = {
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }): Promise<Lesson> => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 2,
        overrideAccess: false,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      return lesson as Lesson;
    }),

  getByIdForChildren: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }): Promise<Lesson> => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 2,
        overrideAccess: false,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      // Validate that the class option has type 'child'
      const classOption = lesson.classOption as ClassOption;
      if (!classOption || classOption.type !== "child") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This lesson is not available for children bookings. Only lessons with child class options are allowed.",
        });
      }

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
  canBookChild: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }): Promise<boolean> => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 2,
        overrideAccess: false,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      if (lesson.remainingCapacity <= 0) {
        return false;
      }

      const classOption = lesson.classOption as ClassOption;
      if (!classOption || classOption.type !== "child") {
        return false;
      }

      const plans = classOption.paymentMethods?.allowedPlans;

      if (plans?.some((plan) => plan.sessionsInformation?.sessions)) {
        const subscription = await ctx.payload.find({
          collection: "subscriptions",
          where: {
            user: {
              equals: ctx.user.id,
            },
            plan: {
              in: plans.map((plan) => plan.id),
            },
          },
          depth: 2,
          limit: 1,
          overrideAccess: false,
        });

        if (subscription.docs.length < 0) {
          return false;
        }

        const subscriptionDoc = subscription.docs[0] as Subscription;

        const allowedSessions =
          subscriptionDoc.plan.sessionsInformation?.sessions;

        const bookedSessions = await ctx.payload.find({
          collection: "bookings",
          where: {
            lesson: {
              equals: lesson.id,
            },
            "user.parent": {
              equals: ctx.user.id,
            },
          },
          depth: 2,
          overrideAccess: false,
        });

        const bookedSessionsCount = bookedSessions.docs.length;

        if (allowedSessions && allowedSessions > bookedSessionsCount) {
          return true;
        }

        return false;
      }

      return true;
    }),
} satisfies TRPCRouterRecord;

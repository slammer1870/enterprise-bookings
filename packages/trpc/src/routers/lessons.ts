import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure, publicProcedure } from "../trpc";

import {
  Booking,
  ClassOption,
  Lesson,
  Subscription,
  User,
} from "@repo/shared-types";

export const lessonsRouter = {
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
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
    .query(async ({ ctx, input }) => {
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
    .query(async ({ ctx, input }) => {
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
    .query(async ({ ctx, input }) => {
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

  bookChild: protectedProcedure
    .input(z.object({ lessonId: z.number(), childId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const child = await ctx.payload.findByID({
        collection: "users",
        id: input.childId,
        depth: 1,
        overrideAccess: false,
      });

      if (!child) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Child with id ${input.childId} not found`,
        });
      }

      if (child.parent !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User is not parent of children",
        });
      }

      const existingBooking = await ctx.payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: input.lessonId },
          user: { equals: child.id },
        },
        depth: 2,
        overrideAccess: false,
        limit: 1,
      });

      if (existingBooking.docs.length > 0) {
        const updatedBooking = await ctx.payload.update({
          collection: "bookings",
          id: existingBooking.docs[0]?.id as number,
          data: {
            status: "confirmed",
          },
          overrideAccess: false,
          user: child,
        });

        return updatedBooking as Booking;
      }

      const booking = await ctx.payload.create({
        collection: "bookings",
        data: {
          lesson: input.lessonId,
          user: child.id,
          status: "confirmed",
        },
        overrideAccess: false,
        user: child,
      });

      return booking as Booking;
    }),

  unbookChild: protectedProcedure
    .input(z.object({ lessonId: z.number(), childId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: input.lessonId },
          user: { equals: input.childId },
        },
        depth: 2,
        overrideAccess: false,
        limit: 1,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with lesson id ${input.lessonId} and user id ${input.childId} not found`,
        });
      }

      const updatedBooking = await ctx.payload.update({
        collection: "bookings",
        id: booking.docs[0]?.id as number,
        data: {
          status: "cancelled",
        },
        overrideAccess: false,
        user: booking.docs[0]?.user as User,
      });

      return updatedBooking as Booking;
    }),
} satisfies TRPCRouterRecord;

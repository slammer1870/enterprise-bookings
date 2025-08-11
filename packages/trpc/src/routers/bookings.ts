import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../trpc";

import { Booking, ClassOption, Subscription } from "@repo/shared-types";

export const bookingsRouter = {
  createBooking: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 3,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      const booking = await ctx.payload.create({
        collection: "bookings",
        data: {
          lesson: input.id,
          user: ctx.user.id,
          status: "confirmed",
        },
        overrideAccess: false,
        user: ctx.user,
      });

      return booking as Booking;
    }),
  cancelBooking: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.payload.findByID({
        collection: "bookings",
        id: input.id,
        depth: 2,
        overrideAccess: false,
      });

      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with id ${input.id} not found`,
        });
      }

      const updatedBooking = await ctx.payload.update({
        collection: "bookings",
        id: input.id,
        data: {
          status: "cancelled",
        },
        overrideAccess: false,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  joinWaitlist: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 3,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      const booking = await ctx.payload.create({
        collection: "bookings",
        data: {
          lesson: input.id,
          user: ctx.user.id,
          status: "waiting",
        },
        overrideAccess: false,
        user: ctx.user,
      });

      return booking as Booking;
    }),
  leaveWaitlist: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.payload.findByID({
        collection: "bookings",
        id: input.id,
        depth: 2,
        overrideAccess: false,
      });

      if (!booking) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with id ${input.id} not found`,
        });
      }

      const updatedBooking = await ctx.payload.update({
        collection: "bookings",
        id: input.id,
        data: {
          status: "cancelled",
        },
        overrideAccess: false,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  canBookChild: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const lesson = await ctx.payload.findByID({
        collection: "lessons",
        id: input.id,
        depth: 3,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
        return false;
      }

      const classOption = lesson.classOption as ClassOption;
      if (!classOption || classOption.type !== "child") {
        return false;
      }

      const plans = classOption.paymentMethods?.allowedPlans;

      if (plans && plans.length > 0) {
        const subscription = await ctx.payload.find({
          collection: "subscriptions",
          where: {
            user: {
              equals: ctx.user.id,
            },
            plan: {
              in: plans.map((plan) => plan.id),
            },
            startDate: {
              less_than_equal: new Date(),
            },
            endDate: {
              greater_than_equal: new Date(),
            },
            status: {
              equals: "active",
            },
            and: [
              {
                or: [
                  { cancelAt: { greater_than: new Date(lesson.startTime) } },
                  { cancelAt: { exists: false } },
                  { cancelAt: { equals: null } },
                ],
              },
            ],
          },
          depth: 2,
          limit: 1,
        });

        if (subscription.docs.length === 0) {
          return false;
        }

        const subscriptionDoc = subscription.docs[0] as Subscription;

        const planQuantity = subscriptionDoc.plan.quantity;

        // First, get all children of the parent user
        const childrenQuery = await ctx.payload.find({
          collection: "users",
          where: {
            parent: { equals: ctx.user.id },
          },
          depth: 1,
          overrideAccess: false,
          user: ctx.user,
        });

        const childrenIds = childrenQuery.docs.map((child: any) => child.id);

        const bookedSessions = await ctx.payload.find({
          collection: "bookings",
          where: {
            lesson: {
              equals: lesson.id,
            },
            user: { in: childrenIds },
          },
          depth: 2,
          overrideAccess: false,
          user: ctx.user,
        });

        const bookedSessionsCount = bookedSessions.docs.length;

        if (planQuantity && planQuantity <= bookedSessionsCount) {
          return false;
        }
      }

      return true;
    }),
  createChildBooking: protectedProcedure
    .input(
      z.object({
        lessonId: z.number(),
        childId: z.number(),
        status: z.enum(["confirmed", "pending"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { status = "pending" } = input;
      const child = await ctx.payload.findByID({
        collection: "users",
        id: input.childId,
        depth: 4,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!child) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Child with id ${input.childId} not found`,
        });
      }

      const existingBooking = await ctx.payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: input.lessonId },
          user: { equals: child.id },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      if (existingBooking.docs.length > 0) {
        const updatedBooking = await ctx.payload.update({
          collection: "bookings",
          id: existingBooking.docs[0]?.id as number,
          data: {
            status: status,
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
          status: status,
        },
        overrideAccess: false,
        user: child,
      });
      return booking as Booking;
    }),
  cancelChildBooking: protectedProcedure
    .input(z.object({ lessonId: z.number(), childId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: input.lessonId },
          user: { equals: input.childId },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with lesson id ${input.lessonId} and user id ${input.childId} not found`,
        });
      }

      const child = await ctx.payload.findByID({
        collection: "users",
        id: input.childId,
        depth: 4,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!child) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Child with id ${input.childId} not found`,
        });
      }

      const updatedBooking = await ctx.payload.update({
        collection: "bookings",
        id: booking.docs[0]?.id as number,
        data: {
          status: "cancelled",
        },
        overrideAccess: false,
        user: child,
      });

      return updatedBooking as Booking;
    }),
  getChildrensBookings: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const bookings = await ctx.payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: input.id },
          "user.parent": { equals: ctx.user.id },
          status: { not_equals: "cancelled" },
        },
        depth: 2,
        overrideAccess: false,
        user: ctx.user,
      });

      return bookings.docs.map((booking) => booking as Booking);
    }),
} satisfies TRPCRouterRecord;

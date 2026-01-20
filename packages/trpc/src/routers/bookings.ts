import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure, requireCollections } from "../trpc";
import { findByIdSafe, findSafe, createSafe, updateSafe } from "../utils/collections";

import { Booking, ClassOption, Lesson, Subscription } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";

export const bookingsRouter = {
  checkIn: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(z.object({ lessonId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { lessonId } = input;

      // Fetch lesson with full depth for business logic validation
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
        depth: 3,
        overrideAccess: false,
        user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // Business Logic: Handle children's lessons differently
      if (lesson.classOption.type === "child") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "REDIRECT_TO_CHILDREN_BOOKING",
          cause: { redirectUrl: `/bookings/children/${lessonId}` },
        });
      }

      // Try to create/update booking - this will use existing access controls
      // which handle membership validation, subscription limits, etc.
      try {
        const existingBooking = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            lesson: { equals: lessonId },
            user: { equals: ctx.user.id },
          },
          depth: 2,
          limit: 1,
          overrideAccess: false,
          user: ctx.user,
        });

        if (existingBooking.docs.length === 0) {
          // Create new booking
          return await createSafe(ctx.payload, "bookings", {
              lesson: lessonId,
              user: ctx.user.id,
              status: "confirmed",
          }, {
            overrideAccess: false,
            user: ctx.user,
          });
        } else {
          // Update existing booking
          return await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
              status: "confirmed",
          }, {
            overrideAccess: false,
            user: ctx.user,
          });
        }
      } catch (error: any) {
        // If booking creation/update fails due to membership/payment issues
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "REDIRECT_TO_BOOKING_PAYMENT",
          cause: {
            redirectUrl: `/bookings/${lessonId}`,
            originalError: error.message,
          },
        });
      }
    }),
  kioskCreateOrConfirmBooking: protectedProcedure
    .use(requireCollections("bookings", "users"))
    .input(z.object({ lessonId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<Booking> => {
      // Kiosk is an admin-only flow: an admin checks a user into a lesson.
      if (!checkRole(["admin"], ctx.user as any)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const selectedUser = await findByIdSafe<any>(
        ctx.payload,
        "users",
        input.userId,
        {
          depth: 2,
          overrideAccess: false,
          user: ctx.user,
        }
      );

      if (!selectedUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User with id ${input.userId} not found`,
        });
      }

      // Look up an existing booking using the admin context (read access).
      const existingBooking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          lesson: { equals: input.lessonId },
          user: { equals: input.userId },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      // Create/update using the selected user context so existing access controls run
      // as if that user is making the booking (membership checks, child-parent logic, etc.).
      if (existingBooking.docs.length > 0) {
        const updated = await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
          status: "confirmed",
        }, {
          overrideAccess: false,
          user: selectedUser,
        });
        return updated as Booking;
      }

      const created = await createSafe<Booking>(ctx.payload, "bookings", {
        lesson: input.lessonId,
        user: input.userId,
        status: "confirmed",
      }, {
        overrideAccess: false,
        user: selectedUser,
      });

      return created as Booking;
    }),
  createBooking: protectedProcedure
    .use(requireCollections("lessons", "bookings", "subscriptions", "users"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
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

      const booking = await createSafe<Booking>(ctx.payload, "bookings", {
          lesson: input.id,
          user: ctx.user.id,
          status: "confirmed",
      }, {
        overrideAccess: false,
        user: ctx.user,
      });

      return booking;
    }),
  createBookings: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(
      z.object({
        lessonId: z.number(),
        quantity: z.number().min(1),
        status: z.enum(["confirmed", "pending"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<Booking[]> => {
      const { lessonId, quantity, status = "confirmed" } = input;

      // Fetch lesson to validate and check remaining capacity
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
          depth: 3,
          overrideAccess: false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // Validate quantity against remaining capacity
      const maxQuantity = Math.max(1, lesson.remainingCapacity || 1);
      if (quantity > maxQuantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot book more than ${maxQuantity} slot${maxQuantity !== 1 ? 's' : ''}. Only ${maxQuantity} available.`,
        });
      }

      if (quantity < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quantity must be at least 1",
        });
      }

      // Create multiple bookings
      const createdBookings: Booking[] = [];
      for (let i = 0; i < quantity; i++) {
        const booking = await createSafe<Booking>(
          ctx.payload,
          "bookings",
          {
            lesson: lessonId,
            user: ctx.user.id,
            status: status,
          },
          {
            overrideAccess: false,
            user: ctx.user,
          }
        );
        createdBookings.push(booking as Booking);
      }

      return createdBookings;
    }),
  createOrUpdateBooking: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["confirmed", "cancelled"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<Booking> => {
      const { id, status = "confirmed" } = input;

      const booking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          lesson: { equals: id },
          user: { equals: ctx.user.id },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      if (booking.docs.length === 0) {
        return await createSafe(ctx.payload, "bookings", {
            lesson: id,
            user: ctx.user.id,
            status,
        }, {
          overrideAccess: false,
          user: ctx.user,
        });
      }

      const updatedBooking = await updateSafe(ctx.payload, "bookings", booking.docs[0]?.id as number, {
          status,
      }, {
        overrideAccess: false,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  cancelBooking: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }): Promise<Booking> => {
      const { id } = input;

      // First, find the booking by ID to verify it exists and belongs to the user
      const booking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          id: { equals: id },
          user: { equals: ctx.user.id },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with id ${input.id} not found`,
        });
      }

      const updatedBooking = await updateSafe(ctx.payload, "bookings", id, {
          status: "cancelled",
      }, {
        overrideAccess: false,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  joinWaitlist: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existingBooking = await findSafe(ctx.payload, "bookings", {
        where: {
          lesson: { equals: input.id },
          user: { equals: ctx.user.id },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      if (existingBooking.docs.length > 0) {
        const updatedBooking = await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
            status: "waiting",
        }, {
          overrideAccess: false,
          user: ctx.user,
        });

        return updatedBooking as Booking;
      }

      const booking = await createSafe(ctx.payload, "bookings", {
          lesson: input.id,
          user: ctx.user.id,
          status: "waiting",
      }, {
        overrideAccess: false,
        user: ctx.user,
      });

      return booking as Booking;
    }),
  leaveWaitlist: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await findSafe(ctx.payload, "bookings", {
        where: {
          lesson: { equals: input.id },
          user: { equals: ctx.user.id },
          status: { equals: "waiting" },
        },
        depth: 2,
        limit: 1,
        overrideAccess: false,
        user: ctx.user,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with id ${input.id} not found`,
        });
      }

      const updatedBooking = await updateSafe(ctx.payload, "bookings", booking.docs[0]?.id as number, {
          status: "cancelled",
      }, {
        overrideAccess: false,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  canBookChild: protectedProcedure
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

      if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
        return false;
      }

      const classOption = lesson.classOption as ClassOption;
      if (!classOption || classOption.type !== "child") {
        return false;
      }

      const plans = classOption.paymentMethods?.allowedPlans;

      if (plans && plans.length > 0) {
        const subscription = await findSafe(ctx.payload, "subscriptions", {
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
                ],
              },
            ],
          },
          depth: 2,
          limit: 1,
          overrideAccess: false,
          user: ctx.user,
        });

        if (subscription.docs.length === 0) {
          return false;
        }

        const subscriptionDoc = subscription.docs[0] as Subscription;

        const planQuantity = subscriptionDoc.plan.quantity;

        // First, get all children of the parent user
        const childrenQuery = await findSafe(ctx.payload, "users", {
          where: {
            parentUser: { equals: ctx.user.id },
          },
          depth: 1,
          overrideAccess: false,
          user: ctx.user,
        });

        const childrenIds = childrenQuery.docs.map((child: any) => child.id);

        const bookedSessions = await findSafe(ctx.payload, "bookings", {
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
    .use(requireCollections("lessons", "bookings", "users"))
    .input(
      z.object({
        lessonId: z.number(),
        childId: z.number(),
        status: z.enum(["confirmed", "pending"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { status = "pending" } = input;
      const child = await findByIdSafe<any>(
        ctx.payload,
        "users",
        input.childId,
        {
        depth: 4,
        overrideAccess: false,
        user: ctx.user,
        }
      );

      if (!child) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Child with id ${input.childId} not found`,
        });
      }

      const existingBooking = await findSafe(ctx.payload, "bookings", {
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
        const updatedBooking = await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
            status: status,
        }, {
          overrideAccess: false,
          user: child,
        });

        return updatedBooking as Booking;
      }

      const booking = await createSafe(ctx.payload, "bookings", {
          lesson: input.lessonId,
          user: child.id,
          status: status,
      }, {
        overrideAccess: false,
        user: child,
      });
      return booking as Booking;
    }),
  cancelChildBooking: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ lessonId: z.number(), childId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await findSafe(ctx.payload, "bookings", {
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

      const child = await findByIdSafe<any>(
        ctx.payload,
        "users",
        input.childId,
        {
        depth: 4,
        overrideAccess: false,
        user: ctx.user,
        }
      );

      if (!child) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Child with id ${input.childId} not found`,
        });
      }

      const updatedBooking = await updateSafe(ctx.payload, "bookings", booking.docs[0]?.id as number, {
          status: "cancelled",
      }, {
        overrideAccess: false,
        user: child,
      });

      return updatedBooking as Booking;
    }),
  getChildrensBookings: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const bookings = await findSafe(ctx.payload, "bookings", {
        where: {
          lesson: { equals: input.id },
          "user.parentUser": { equals: ctx.user.id },
          status: { not_equals: "cancelled" },
        },
        depth: 2,
        overrideAccess: false,
        user: ctx.user,
      });

      return bookings.docs.map((booking: any) => booking as Booking);
    }),
  getUserBookingsForLesson: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const bookings = await findSafe(ctx.payload, "bookings", {
        where: {
          lesson: { equals: input.lessonId },
          user: { equals: ctx.user.id },
          status: { not_equals: "cancelled" },
        },
        depth: 2,
        overrideAccess: false,
        user: ctx.user,
      });

      return bookings.docs.map((booking: any) => booking as Booking);
    }),
  /**
   * Validates if a user can be checked in for a lesson and attempts check-in if possible.
   * This is designed to be called at the page level before rendering booking components.
   * 
   * @returns Object indicating whether check-in succeeded and redirect should occur
   */
  validateAndAttemptCheckIn: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(z.object({ lessonId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { lessonId } = input;

      // Fetch lesson with full depth for validation
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
          depth: 3,
          overrideAccess: false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // Check if lesson status allows immediate check-in
      if (!['active', 'trialable'].includes(lesson.bookingStatus || '')) {
        return {
          shouldRedirect: false,
          error: null,
          reason: `Lesson status is ${lesson.bookingStatus}, check-in not available`,
        };
      }

      // Attempt check-in by calling the existing checkIn procedure logic
      try {
        // Business Logic: Handle children's lessons differently
        if (lesson.classOption.type === "child") {
          return {
            shouldRedirect: false,
            error: "REDIRECT_TO_CHILDREN_BOOKING",
            reason: "This is a children's lesson",
            redirectUrl: `/bookings/children/${lessonId}`,
          };
        }

        // Try to create/update booking
        const existingBooking = await findSafe(ctx.payload, "bookings", {
          where: {
            lesson: { equals: lessonId },
            user: { equals: ctx.user.id },
          },
          depth: 2,
          limit: 1,
          overrideAccess: false,
          user: ctx.user,
        });

        if (existingBooking.docs.length === 0) {
          // Create new booking
          await createSafe(ctx.payload, "bookings", {
            lesson: lessonId,
            user: ctx.user.id,
            status: "confirmed",
          }, {
            overrideAccess: false,
            user: ctx.user,
          });
        } else {
          // Update existing booking
          await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
            status: "confirmed",
          }, {
            overrideAccess: false,
            user: ctx.user,
          });
        }

        // Check-in succeeded
        return {
          shouldRedirect: true,
          error: null,
          reason: null,
        };
      } catch (error: any) {
        // If booking creation/update fails due to membership/payment issues
        return {
          shouldRedirect: false,
          error: "REDIRECT_TO_BOOKING_PAYMENT",
          reason: error.message || "Check-in failed - payment required",
          redirectUrl: `/bookings/${lessonId}`,
        };
      }
    }),
} satisfies TRPCRouterRecord;

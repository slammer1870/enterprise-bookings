import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure, requireCollections } from "../trpc";
import { findByIdSafe, findSafe, createSafe, updateSafe, hasCollection } from "../utils/collections";

import { Booking, ClassOption, Lesson, LessonScheduleState, Subscription } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";

export const bookingsRouter = {
  checkIn: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(z.object({ lessonId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { lessonId } = input;

      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // Resolve tenant ID from slug if available
      // For backward compatibility with non-multi-tenant apps, check if tenants collection exists
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          // Check if tenants collection exists (for backward compatibility with non-multi-tenant apps)
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
          // If tenants collection doesn't exist or tenant not found, continue without tenant filter
        } catch (error) {
          // If tenant lookup fails, continue without tenant filter for backward compatibility
          console.error("Error resolving tenant (continuing without tenant filter):", error);
        }
      }

      // Fetch lesson with full depth for business logic validation
      // When we have tenant context, use overrideAccess: true to bypass multi-tenant
      // plugin filtering (which filters by user's tenants array).
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
          depth: 3,
          overrideAccess: tenantId ? true : false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // If we have tenant context, verify the lesson belongs to that tenant
      if (tenantId) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant;

        if (lessonTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Lesson with id ${lessonId} not found`,
          });
        }
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
      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // Resolve tenant ID from slug if available
      // For backward compatibility with non-multi-tenant apps, check if tenants collection exists
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          // Check if tenants collection exists (for backward compatibility with non-multi-tenant apps)
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
          // If tenants collection doesn't exist or tenant not found, continue without tenant filter
        } catch (error) {
          // If tenant lookup fails, continue without tenant filter for backward compatibility
          console.error("Error resolving tenant (continuing without tenant filter):", error);
        }
      }

      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        input.id,
        {
          depth: 3,
          overrideAccess: tenantId ? true : false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      // If we have tenant context, verify the lesson belongs to that tenant
      if (tenantId) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant;

        if (lessonTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Lesson with id ${input.id} not found`,
          });
        }
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

      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // Resolve tenant ID from slug if available
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          // Backward compatibility with non-multi-tenant apps (no tenants collection)
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true, // Allow public lookup
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
        } catch (error) {
          console.error("Error resolving tenant:", error);
        }
      }

      // Fetch lesson to validate and check remaining capacity
      // When we have tenant context, use overrideAccess: true to bypass multi-tenant
      // plugin filtering (which filters by user's tenants array). We'll verify the
      // lesson belongs to the correct tenant manually if needed.
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
          depth: 3,
          overrideAccess: tenantId ? true : false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // If we have tenant context, verify the lesson belongs to that tenant
      if (tenantId) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant;

        if (lessonTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Lesson with id ${lessonId} not found`,
          });
        }
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

      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // Resolve tenant ID from slug if available
      // For backward compatibility with non-multi-tenant apps, check if tenants collection exists
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          // Check if tenants collection exists (for backward compatibility with non-multi-tenant apps)
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
          // If tenants collection doesn't exist or tenant not found, continue without tenant filter
        } catch (error) {
          // If tenant lookup fails, continue without tenant filter for backward compatibility
          console.error("Error resolving tenant (continuing without tenant filter):", error);
        }
      }

      // First, find the booking by ID to verify it exists and belongs to the user
      // When we have tenant context, use overrideAccess: true to bypass multi-tenant
      // plugin filtering (which filters by user's tenants array).
      const booking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          id: { equals: id },
          user: { equals: ctx.user.id },
        },
        depth: 2,
        limit: 1,
        overrideAccess: tenantId ? true : false,
        user: ctx.user,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with id ${input.id} not found`,
        });
      }

      // If we have tenant context, verify the booking belongs to that tenant
      if (tenantId && booking.docs[0]) {
        const bookingDoc = booking.docs[0] as any;
        let bookingTenantId: number | null = null;

        // Check booking.tenant first
        if (bookingDoc.tenant) {
          bookingTenantId = typeof bookingDoc.tenant === 'object' && bookingDoc.tenant !== null
            ? bookingDoc.tenant.id
            : bookingDoc.tenant;
        }
        // Otherwise check via lesson.tenant
        else if (typeof bookingDoc.lesson === 'object' && bookingDoc.lesson?.tenant) {
          bookingTenantId = typeof bookingDoc.lesson.tenant === 'object' && bookingDoc.lesson.tenant !== null
            ? bookingDoc.lesson.tenant.id
            : bookingDoc.lesson.tenant;
        }

        if (bookingTenantId && bookingTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Booking with id ${input.id} not found`,
          });
        }
      }

      const updatedBooking = await updateSafe(ctx.payload, "bookings", id, {
        status: "cancelled",
      }, {
        overrideAccess: tenantId ? true : false,
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
      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      let tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // If the cookie isn't present yet (e.g. first request on a subdomain),
      // fall back to deriving tenant slug from the Host header.
      if (!tenantSlug) {
        const hostHeader = ctx.headers.get("x-forwarded-host") || ctx.headers.get("host") || "";
        const hostWithoutPort = hostHeader.split(":")[0] || "";
        const parts = hostWithoutPort.split(".");
        const isLocalhost = hostWithoutPort.includes("localhost");

        if (isLocalhost) {
          // subdomain.localhost
          if (parts.length > 1 && parts[0] && parts[0] !== "localhost") {
            tenantSlug = parts[0];
          }
        } else {
          // subdomain.domain.tld
          if (parts.length >= 3 && parts[0]) {
            tenantSlug = parts[0];
          }
        }
      }

      // Resolve tenant ID from slug if available
      // For backward compatibility with non-multi-tenant apps, check if tenants collection exists
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          // Check if tenants collection exists (for backward compatibility with non-multi-tenant apps)
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
          // If tenants collection doesn't exist or tenant not found, continue without tenant filter
        } catch (error) {
          // If tenant lookup fails, continue without tenant filter for backward compatibility
          console.error("Error resolving tenant (continuing without tenant filter):", error);
        }
      }

      // If tenant ID wasn't resolved from headers/cookie, try to get it from the lesson itself
      // This ensures we can filter correctly even when tenant context isn't available in headers
      if (!tenantId && hasCollection(ctx.payload, "lessons")) {
        try {
          const lesson = await findSafe(ctx.payload, "lessons", {
            where: { id: { equals: input.lessonId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          if (lesson.docs[0]?.tenant) {
            const lessonTenant = lesson.docs[0].tenant;
            tenantId = typeof lessonTenant === 'object' && lessonTenant !== null && 'id' in lessonTenant
              ? lessonTenant.id as number
              : typeof lessonTenant === 'number'
                ? lessonTenant
                : null;
          }
        } catch (error) {
          // If lesson lookup fails, continue without tenant filter
          console.error("Error resolving tenant from lesson (continuing without tenant filter):", error);
        }
      }

      // Build where clause - when we have tenant context, we'll filter by tenant after fetching
      // to ensure we get all bookings for the user, even if they don't have tenant in tenants array
      const whereClause: any = {
        lesson: { equals: input.lessonId },
        user: { equals: ctx.user.id },
        status: { not_equals: "cancelled" },
      };

      // When we have tenant context (from headers or lesson), use overrideAccess: true to bypass multi-tenant
      // plugin filtering (which filters by user's tenants array). We'll filter by tenant
      // manually after fetching to ensure bookings belong to the correct tenant.
      // 
      // Note: We use findSafe which doesn't support req parameter, so we rely on
      // overrideAccess: true to bypass filtering, then manually filter by tenant.
      const bookings = await findSafe(ctx.payload, "bookings", {
        where: whereClause,
        depth: 2, // depth: 2 should populate lesson.tenant
        overrideAccess: tenantId ? true : false,
        user: ctx.user,
      });

      // Filter by tenant if tenant context is available (for multi-tenant apps)
      // Bookings have a lesson relationship, and the lesson has the tenant field
      // With depth: 2, the lesson should be populated, so we can check lesson.tenant
      let filteredBookings = bookings.docs;
      if (tenantId) {
        filteredBookings = bookings.docs.filter((booking: any) => {
          // First check if booking has tenant directly (some multi-tenant setups)
          if (booking.tenant) {
            const bookingTenantId = typeof booking.tenant === 'object' && booking.tenant !== null
              ? booking.tenant.id
              : booking.tenant;
            if (bookingTenantId === tenantId) {
              return true;
            }
            // If booking has a different tenant, exclude it
            return false;
          }

          // Otherwise check via lesson.tenant (with depth: 2, lesson should be populated)
          if (typeof booking.lesson === 'object' && booking.lesson && booking.lesson !== null) {
            if (booking.lesson.tenant) {
              const lessonTenantId = typeof booking.lesson.tenant === 'object' && booking.lesson.tenant !== null
                ? booking.lesson.tenant.id
                : booking.lesson.tenant;
              if (lessonTenantId === tenantId) {
                return true;
              }
              // If lesson has a different tenant, exclude it
              return false;
            }
          }

          // If no tenant found on booking or lesson, include it (backward compatibility)
          // This handles cases where:
          // 1. Lesson isn't populated (shouldn't happen with depth: 2, but handle gracefully)
          // 2. Non-multi-tenant apps (bookings don't have tenant fields)
          // 3. Bookings from before tenant was added
          // We include these to avoid breaking existing functionality
          return true;
        });

        // Debug logging to help diagnose issues
        if (bookings.docs.length > 0 && filteredBookings.length === 0) {
          console.warn(`[getUserBookingsForLesson] Filtered out all ${bookings.docs.length} bookings for lesson ${input.lessonId}, user ${ctx.user.id}, tenant ${tenantId}`);
          console.warn(`[getUserBookingsForLesson] Sample booking structure:`, {
            bookingId: bookings.docs[0]?.id,
            hasTenant: !!bookings.docs[0]?.tenant,
            lessonType: typeof bookings.docs[0]?.lesson,
            lessonHasTenant: typeof bookings.docs[0]?.lesson === 'object' ? !!bookings.docs[0]?.lesson?.tenant : 'N/A',
          });
        }
      }

      return filteredBookings.map((booking: any) => booking as Booking);
    }),
  /**
   * Unified schedule mutation: set the current viewer's booking intent for a lesson.
   *
   * This is designed for the schedule button UX:
   * - one endpoint for book/cancel/waitlist actions
   * - returns a scheduleState snapshot so the UI can update predictably
   */
  setMyBookingForLesson: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(
      z.object({
        lessonId: z.number(),
        intent: z.enum(["confirm", "cancel", "joinWaitlist", "leaveWaitlist"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { lessonId, intent } = input;

      const viewerIdRaw: any = (ctx.user as any)?.id;
      const viewerId =
        typeof viewerIdRaw === "string" ? parseInt(viewerIdRaw, 10) : viewerIdRaw;
      if (!viewerId || Number.isNaN(viewerId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid user ID" });
      }

      // Resolve tenant context (cookie -> host -> lesson fallback)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      let tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      if (!tenantSlug) {
        const hostHeader =
          ctx.headers.get("x-forwarded-host") || ctx.headers.get("host") || "";
        const hostWithoutPort = hostHeader.split(":")[0] || "";
        const parts = hostWithoutPort.split(".");
        const isLocalhost = hostWithoutPort.includes("localhost");

        if (isLocalhost) {
          if (parts.length > 1 && parts[0] && parts[0] !== "localhost") {
            tenantSlug = parts[0];
          }
        } else {
          if (parts.length >= 3 && parts[0]) {
            tenantSlug = parts[0];
          }
        }
      }

      let tenantId: number | null = null;
      if (tenantSlug && hasCollection(ctx.payload, "tenants")) {
        try {
          const tenantResult = await findSafe(ctx.payload, "tenants", {
            where: { slug: { equals: tenantSlug } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          if (tenantResult.docs[0]) tenantId = tenantResult.docs[0].id as number;
        } catch {
          // ignore; backward compatibility
        }
      }

      if (!tenantId && hasCollection(ctx.payload, "lessons")) {
        try {
          const lessonLookup = await findSafe(ctx.payload, "lessons", {
            where: { id: { equals: lessonId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          const lt = (lessonLookup.docs[0] as any)?.tenant;
          if (lt) {
            tenantId =
              typeof lt === "object" && lt !== null && "id" in lt
                ? (lt as any).id
                : typeof lt === "number"
                  ? lt
                  : null;
          }
        } catch {
          // ignore
        }
      }

      const lesson = await findByIdSafe<Lesson>(ctx.payload, "lessons", lessonId, {
        depth: 2,
        overrideAccess: tenantId ? true : false,
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Lesson with id ${lessonId} not found` });
      }

      if (tenantId) {
        const lessonTenantId =
          typeof lesson.tenant === "object" && lesson.tenant !== null
            ? lesson.tenant.id
            : lesson.tenant;
        if (lessonTenantId !== tenantId) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Lesson with id ${lessonId} not found` });
        }
      }

      const computeScheduleState = async (): Promise<LessonScheduleState> => {
        const now = new Date();
        const start = new Date(lesson.startTime);
        const startMs = start.getTime();
        const lockOutTime = typeof (lesson as any).lockOutTime === "number" ? (lesson as any).lockOutTime : 0;

        const closed =
          Number.isFinite(startMs) &&
          (now.getTime() >= startMs ||
            (lockOutTime > 0 && now.getTime() >= startMs - lockOutTime * 60_000));

        const bookingsResult = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            and: [
              { lesson: { equals: lessonId } },
              { status: { in: ["confirmed", "waiting"] } },
            ],
          },
          depth: 2,
          limit: 0,
          overrideAccess: tenantId ? true : false,
          user: ctx.user,
        });

        const bookings = bookingsResult.docs as any[];
        const totalConfirmedCount = bookings.filter((b) => b.status === "confirmed").length;
        const places = typeof (lesson.classOption as any)?.places === "number" ? (lesson.classOption as any).places : null;
        const isFull = typeof places === "number" ? totalConfirmedCount >= places : false;

        const viewerConfirmedIds: number[] = [];
        const viewerWaitingIds: number[] = [];
        const isChildClass = (lesson.classOption as any)?.type === "child";

        for (const b of bookings) {
          const bookingUser = b.user;
          const bookingUserId =
            typeof bookingUser === "object" && bookingUser !== null ? bookingUser.id : bookingUser;
          const bookingParentId =
            typeof bookingUser === "object" && bookingUser !== null
              ? typeof bookingUser.parentUser === "object" && bookingUser.parentUser !== null
                ? bookingUser.parentUser.id
                : bookingUser.parentUser
              : null;

          const matchesViewer = isChildClass ? bookingParentId === viewerId : bookingUserId === viewerId;
          if (!matchesViewer) continue;

          if (b.status === "confirmed") viewerConfirmedIds.push(Number(b.id));
          if (b.status === "waiting") viewerWaitingIds.push(Number(b.id));
        }

        const availability: LessonScheduleState["availability"] = closed ? "closed" : isFull ? "full" : "open";

        let action: LessonScheduleState["action"] = "book";
        if (availability === "closed") action = "closed";
        else if (isChildClass) action = "manageChildren";
        else if (viewerConfirmedIds.length >= 2) action = "modify";
        else if (viewerConfirmedIds.length === 1) action = "cancel";
        else if (viewerWaitingIds.length > 0) action = "leaveWaitlist";
        else if (availability === "full") action = "joinWaitlist";
        else action = "book";

        const labelByAction: Record<LessonScheduleState["action"], string> = {
          book: "Book",
          cancel: "Cancel Booking",
          modify: "Modify Booking",
          joinWaitlist: "Join Waitlist",
          leaveWaitlist: "Leave Waitlist",
          closed: "Closed",
          loginToBook: "Book",
          manageChildren: "Manage Children",
        };

        return {
          availability,
          viewer: {
            confirmedIds: viewerConfirmedIds,
            confirmedCount: viewerConfirmedIds.length,
            waitingIds: viewerWaitingIds,
            waitingCount: viewerWaitingIds.length,
          },
          action,
          label: labelByAction[action],
        };
      };

      // Child lessons are handled on the dedicated children booking page.
      if ((lesson.classOption as any)?.type === "child") {
        return {
          scheduleState: await computeScheduleState(),
          redirectUrl: `/bookings/children/${lessonId}`,
        };
      }

      const currentState = await computeScheduleState();

      // Execute intent
      if (intent === "confirm") {
        if (currentState.availability === "closed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Lesson is closed" });
        }
        if (currentState.viewer.confirmedCount === 0) {
          await createSafe(ctx.payload, "bookings", {
            lesson: lessonId,
            user: viewerId,
            status: "confirmed",
          }, {
            overrideAccess: false,
            user: ctx.user,
          });
        }
      } else if (intent === "cancel") {
        if (currentState.viewer.confirmedCount >= 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Multiple bookings exist; manage bookings to cancel",
          });
        }
        const bookingId = currentState.viewer.confirmedIds[0];
        if (bookingId) {
          await updateSafe(ctx.payload, "bookings", bookingId, { status: "cancelled" }, {
            overrideAccess: false,
            user: ctx.user,
          });
        }
      } else if (intent === "joinWaitlist") {
        if (currentState.availability !== "full") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Lesson is not full" });
        }
        if (currentState.viewer.waitingCount === 0 && currentState.viewer.confirmedCount === 0) {
          await createSafe(ctx.payload, "bookings", {
            lesson: lessonId,
            user: viewerId,
            status: "waiting",
          }, {
            overrideAccess: false,
            user: ctx.user,
          });
        }
      } else if (intent === "leaveWaitlist") {
        for (const bookingId of currentState.viewer.waitingIds) {
          await updateSafe(ctx.payload, "bookings", bookingId, { status: "cancelled" }, {
            overrideAccess: false,
            user: ctx.user,
          });
        }
      }

      return {
        scheduleState: await computeScheduleState(),
      };
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

      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // Resolve tenant ID from slug if available
      // For backward compatibility with non-multi-tenant apps, check if tenants collection exists
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          // Check if tenants collection exists (for backward compatibility with non-multi-tenant apps)
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
          // If tenants collection doesn't exist or tenant not found, continue without tenant filter
        } catch (error) {
          // If tenant lookup fails, continue without tenant filter for backward compatibility
          console.error("Error resolving tenant (continuing without tenant filter):", error);
        }
      }

      // Fetch lesson with full depth for validation
      // When we have tenant context, use overrideAccess: true to bypass multi-tenant
      // plugin filtering (which filters by user's tenants array).
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
          depth: 3,
          overrideAccess: tenantId ? true : false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // If we have tenant context, verify the lesson belongs to that tenant
      if (tenantId) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant;

        if (lessonTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Lesson with id ${lessonId} not found`,
          });
        }
      }

      // Check if lesson status allows immediate check-in
      if (!['active', 'trialable'].includes(lesson.bookingStatus || '')) {
        return {
          shouldRedirect: false,
          error: null,
          reason: `Lesson status is ${lesson.bookingStatus}, check-in not available`,
        };
      }

      console.log("User is authenticated:", ctx.user);

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
          // Ensure user ID is a number for Payload validation
          const userId = typeof ctx.user.id === 'string' ? parseInt(ctx.user.id, 10) : ctx.user.id;
          
          if (!userId || isNaN(userId as number)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid user ID",
            });
          }

          await createSafe(ctx.payload, "bookings", {
            lesson: lessonId,
            user: userId,
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
        console.error("Error validating and attempting check-in:", error);
        // If booking creation/update fails due to membership/payment issues
        return {
          shouldRedirect: false,
          error: "REDIRECT_TO_BOOKING_PAYMENT",
          reason: error.message || "Check-in failed - payment required",
          redirectUrl: `/bookings/${lessonId}`,
        };
      }
    }),
  setMyBookingQuantityForLesson: protectedProcedure
    .use(requireCollections("lessons", "bookings"))
    .input(
      z.object({
        lessonId: z.number(),
        desiredQuantity: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }): Promise<Booking[]> => {
      const { lessonId, desiredQuantity } = input;

      // Extract tenant slug from cookie header (from subdomain)
      const cookieHeader = ctx.headers.get("cookie") || "";
      const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
      const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

      // Resolve tenant ID from slug if available
      let tenantId: number | null = null;
      if (tenantSlug) {
        try {
          if (hasCollection(ctx.payload, "tenants")) {
            const tenantResult = await findSafe(ctx.payload, "tenants", {
              where: {
                slug: {
                  equals: tenantSlug,
                },
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (tenantResult.docs[0]) {
              tenantId = tenantResult.docs[0].id as number;
            }
          }
        } catch (error) {
          console.error("Error resolving tenant (continuing without tenant filter):", error);
        }
      }

      // Fetch lesson with full depth for validation
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        lessonId,
        {
          depth: 3,
          overrideAccess: tenantId ? true : false,
          user: ctx.user,
        }
      );

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${lessonId} not found`,
        });
      }

      // If we have tenant context, verify the lesson belongs to that tenant
      if (tenantId) {
        const lessonTenantId = typeof lesson.tenant === 'object' && lesson.tenant !== null
          ? lesson.tenant.id
          : lesson.tenant;

        if (lessonTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Lesson with id ${lessonId} not found`,
          });
        }
      }

      // Fetch current user's non-cancelled bookings for this lesson
      const whereClause: any = {
        lesson: { equals: lessonId },
        user: { equals: ctx.user.id },
        status: { not_equals: "cancelled" },
      };

      const currentBookings = await findSafe<Booking>(ctx.payload, "bookings", {
        where: whereClause,
        depth: 1,
        overrideAccess: tenantId ? true : false,
        user: ctx.user,
      });

      // Filter by tenant if tenant context is available
      let filteredBookings = currentBookings.docs;
      if (tenantId) {
        filteredBookings = currentBookings.docs.filter((booking: any) => {
          if (booking.tenant) {
            const bookingTenantId = typeof booking.tenant === 'object' && booking.tenant !== null
              ? booking.tenant.id
              : booking.tenant;
            if (bookingTenantId === tenantId) {
              return true;
            }
            return false;
          }

          if (typeof booking.lesson === 'object' && booking.lesson && booking.lesson !== null) {
            if (booking.lesson.tenant) {
              const lessonTenantId = typeof booking.lesson.tenant === 'object' && booking.lesson.tenant !== null
                ? booking.lesson.tenant.id
                : booking.lesson.tenant;
              if (lessonTenantId === tenantId) {
                return true;
              }
              return false;
            }
          }

          return true; // Backward compatibility
        });
      }

      // Compute current confirmed bookings count
      const confirmedBookings = filteredBookings.filter(
        (booking) => booking.status === "confirmed"
      );
      const currentConfirmed = confirmedBookings.length;

      // No-op: desired equals current
      if (desiredQuantity === currentConfirmed) {
        return confirmedBookings as Booking[];
      }

      // Increasing quantity: create additional bookings
      if (desiredQuantity > currentConfirmed) {
        const additional = desiredQuantity - currentConfirmed;

        // Validate capacity
        const maxAdditional = lesson.remainingCapacity || 0;
        if (additional > maxAdditional) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot book more than ${maxAdditional} additional slot${maxAdditional !== 1 ? 's' : ''}. Only ${maxAdditional} available.`,
          });
        }

        // Create additional bookings
        const newBookings: Booking[] = [];
        for (let i = 0; i < additional; i++) {
          const booking = await createSafe<Booking>(
            ctx.payload,
            "bookings",
            {
              lesson: lessonId,
              user: ctx.user.id,
              status: "confirmed",
            },
            {
              overrideAccess: false,
              user: ctx.user,
            }
          );
          newBookings.push(booking as Booking);
        }

        // Fetch the newly created bookings with same depth as existing ones for consistency
        const newBookingIds = newBookings.map(b => b.id).filter((id): id is number => typeof id === 'number');
        if (newBookingIds.length > 0) {
          const fetchedNewBookings = await findSafe<Booking>(ctx.payload, "bookings", {
            where: {
              id: { in: newBookingIds },
            },
            depth: 1,
            overrideAccess: tenantId ? true : false,
            user: ctx.user,
          });

          // Return all confirmed bookings (existing + newly fetched with consistent depth)
          return [...confirmedBookings, ...fetchedNewBookings.docs] as Booking[];
        }

        // Return all confirmed bookings (existing + new)
        return [...confirmedBookings, ...newBookings] as Booking[];
      }

      // Decreasing quantity: cancel some bookings (newest-first by createdAt)
      if (desiredQuantity < currentConfirmed) {
        const toCancel = currentConfirmed - desiredQuantity;

        // Sort confirmed bookings by createdAt descending (newest first)
        const sortedBookings = [...confirmedBookings].sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime; // Descending order
        });

        // Cancel the newest bookings
        for (let i = 0; i < toCancel && i < sortedBookings.length; i++) {
          const bookingToCancel = sortedBookings[i];
          if (!bookingToCancel) continue;

          const bookingId = bookingToCancel.id;
          if (!bookingId) continue;

          await updateSafe(
            ctx.payload,
            "bookings",
            bookingId as number,
            {
              status: "cancelled",
            },
            {
              overrideAccess: tenantId ? true : false,
              user: ctx.user,
            }
          );
        }

        // Return remaining confirmed bookings
        const remainingBookings = sortedBookings.slice(toCancel);
        return remainingBookings as Booking[];
      }

      // Should never reach here, but return empty array as fallback
      return [];
    }),
} satisfies TRPCRouterRecord;

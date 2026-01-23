import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { CollectionSlug } from "payload";

import { TRPCRouterRecord } from "@trpc/server";
import {
  protectedProcedure,
  publicProcedure,
  requireCollections,
} from "../trpc";
import { findByIdSafe, findSafe, hasCollection } from "../utils/collections";

import { ClassOption, Lesson, Booking } from "@repo/shared-types";
import { checkRole, getDayRange } from "@repo/shared-utils";

export const lessonsRouter = {
  getById: protectedProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
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

      return lesson;
    }),

  getByIdForBooking: protectedProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
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

      // When we have tenant context, use overrideAccess: true to bypass multi-tenant
      // plugin filtering (which filters by user's tenants array). We'll verify the
      // lesson belongs to the correct tenant manually if needed.
      const lesson = await findByIdSafe<Lesson>(
        ctx.payload,
        "lessons",
        input.id,
        {
          depth: 5,
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

      // Validate lesson is bookable
      // NOTE: `bookingStatus` is computed per-viewer:
      // - "booked"/"multipleBooked"/"childrenBooked" means *this user* already has a booking.
      // - "waitlist" means the class is full (for users who are not booked).
      if (lesson.bookingStatus === "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This lesson is no longer available for booking",
        });
      }

      if (
        lesson.bookingStatus === "booked" ||
        lesson.bookingStatus === "multipleBooked" ||
        lesson.bookingStatus === "childrenBooked"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already booked on this lesson",
        });
      }

      if (lesson.bookingStatus === "waiting") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already on the waitlist for this lesson",
        });
      }

      // Validate remaining capacity
      if (lesson.remainingCapacity <= 0 || lesson.bookingStatus === "waitlist") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This lesson is fully booked",
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

        // Extract tenant slug from cookie header
        // This comes from the subdomain (set by middleware) - NOT from the user's tenants array
        const cookieHeader = ctx.headers.get("cookie") || "";
        const tenantSlugMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
        const tenantSlug = tenantSlugMatch ? tenantSlugMatch[1] : null;

        // Resolve tenant ID from slug if available
        // If tenant slug is provided but tenant doesn't exist or collection doesn't exist
        // (non-multi-tenant apps), continue without tenant filtering (backward compatible)
        let tenantId: number | null = null;
        if (tenantSlug) {
          try {
            // Check if tenants collection exists (for backward compatibility with non-multi-tenant apps)
            if (!hasCollection(ctx.payload, "tenants")) {
              // Non-multi-tenant app - ignore tenant slug and continue without filtering
              tenantId = null;
            } else {
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
              // If tenant slug provided but tenant doesn't exist, continue without tenant filter
              // This allows the query to work (may return lessons from other tenants, but that's
              // acceptable for backward compatibility - multi-tenant apps should ensure tenant exists)
            }
          } catch (error) {
            // If tenant lookup fails (e.g., collection doesn't exist in non-multi-tenant apps),
            // continue without tenant filtering for backward compatibility
            console.error("Error resolving tenant (continuing without tenant filter):", error);
            tenantId = null;
          }
        }

        const startOfDay = new Date(input.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(input.date);
        endOfDay.setHours(23, 59, 59, 999);

        // Build where clause with date range and tenant filter
        // CRITICAL: We MUST explicitly filter by tenant in the where clause.
        // The access control (tenantScopedReadFiltered) also returns a tenant filter,
        // but having the explicit filter ensures the query works correctly.
        // Payload combines access control constraints with where clauses, and having
        // both ensures the tenant filter is applied even if there are issues with
        // how Payload combines them.
        //
        // This allows cross-tenant booking - users can see lessons for the tenant
        // they're viewing (from subdomain), regardless of their tenant assignments.
        const whereClause: any = tenantId
          ? {
              and: [
                {
                  startTime: {
                    greater_than_equal: startOfDay.toISOString(),
                    less_than_equal: endOfDay.toISOString(),
                  },
                },
                {
                  tenant: {
                    equals: tenantId,
                  },
                },
              ],
            }
          : {
              startTime: {
                greater_than_equal: startOfDay.toISOString(),
                less_than_equal: endOfDay.toISOString(),
              },
            };

        const queryOptions: {
          where: any;
          depth: number;
          sort: string;
          overrideAccess: boolean;
          req?: any;
        } = {
          where: whereClause,
          depth: 2,
          sort: "startTime",
          // CRITICAL: When we have an explicit tenant filter in the where clause AND
          // req.context.tenant set, we can use overrideAccess: true to bypass the
          // multi-tenant plugin's automatic filtering (which filters by user's tenants array).
          // The explicit where clause already filters by the subdomain tenant, so we don't
          // need the plugin's filtering. This allows cross-tenant booking.
          overrideAccess: tenantId ? true : false,
        };

        // Set tenant context on req for multi-tenant plugin filtering
        // Always create req object to ensure access control sees both user and tenant context
        // The req object needs payload property for proper PayloadRequest structure
        queryOptions.req = {
          ...ctx.payload, // Include payload for proper PayloadRequest structure
          context: tenantId ? { tenant: tenantId } : {},
          user: user || null,
          payload: ctx.payload, // Explicitly set payload property
        } as any;

        // Use payload.find directly to pass req with tenant context
        // When tenantId is set, we use overrideAccess: true to bypass the multi-tenant
        // plugin's automatic filtering (which filters by user's tenants array) and rely
        // on our explicit where clause filter (which filters by subdomain tenant).
        const lessons = await ctx.payload.find({
          collection: "lessons" as CollectionSlug,
          where: queryOptions.where,
          depth: queryOptions.depth,
          sort: queryOptions.sort,
          overrideAccess: queryOptions.overrideAccess,
          req: queryOptions.req,
        });

        // Batch-fetch booking counts for all lessons to avoid N+1 queries
        // Only fetch if user is authenticated
        let bookingCountsMap: Map<number, number> = new Map();
        if (user) {
          const lessonIds = lessons.docs.map((lesson: any) => lesson.id);
          
          if (lessonIds.length > 0) {
            // Fetch all user's confirmed bookings for these lessons in one query
            const bookingsWhere: any = {
              and: [
                {
                  lesson: {
                    in: lessonIds,
                  },
                },
                {
                  user: {
                    equals: user.id,
                  },
                },
                {
                  status: {
                    equals: "confirmed",
                  },
                },
              ],
            };

            // Add tenant filter if we have tenant context
            if (tenantId) {
              bookingsWhere.and.push({
                tenant: {
                  equals: tenantId,
                },
              });
            }

            const userBookings = await findSafe<Booking>(ctx.payload, "bookings", {
              where: bookingsWhere,
              depth: 1,
              overrideAccess: tenantId ? true : false,
              user: user,
            });

            // Count bookings per lesson
            userBookings.docs.forEach((booking: any) => {
              const lessonId = typeof booking.lesson === 'object' && booking.lesson !== null
                ? booking.lesson.id
                : booking.lesson;
              
              if (lessonId) {
                const currentCount = bookingCountsMap.get(lessonId) || 0;
                bookingCountsMap.set(lessonId, currentCount + 1);
              }
            });
          }
        }

        // Add myBookingCount to each lesson
        return lessons.docs.map((lesson: any) => {
          const lessonWithCount = lesson as Lesson;
          lessonWithCount.myBookingCount = bookingCountsMap.get(lesson.id) || 0;
          return lessonWithCount;
        });
      } catch (error) {
        console.error("Error in getByDate:", error);
        // Log more details for debugging
        if (error instanceof Error) {
          console.error("Error stack:", error.stack);
          console.error("Error name:", error.name);
        }
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

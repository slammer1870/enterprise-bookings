import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { CollectionSlug, SelectType } from "payload";

import { TRPCRouterRecord } from "@trpc/server";
import {
  protectedProcedure,
  publicProcedure,
  requireCollections,
} from "../trpc";
import { findByIdSafe, findSafe, hasCollection } from "../utils/collections";
import {
  getTenantSlug,
  resolveTenantId,
  resolveTenantTimeZone,
  assertLessonBelongsToTenant,
  populateLessonClassOption,
  deriveTenantIdFromLesson,
} from "../utils/tenant";

import { ClassOption, Lesson, LessonScheduleState } from "@repo/shared-types";
import {
  checkRole,
  getDayRange,
  getDayBoundsInTimeZone,
  resolveTimeZone,
} from "@repo/shared-utils";

export const lessonsRouter = {
  getById: protectedProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantSlug = getTenantSlug(ctx);
      const tenantId = await resolveTenantId(ctx.payload, tenantSlug);

      const lesson = await findByIdSafe<Lesson>(ctx.payload, "lessons", input.id, {
        depth: 3,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      let effectiveTenantId = tenantId;
      if (effectiveTenantId == null) {
        effectiveTenantId = deriveTenantIdFromLesson(lesson);
      }

      if (effectiveTenantId) {
        assertLessonBelongsToTenant(lesson, effectiveTenantId, input.id);
        await populateLessonClassOption(ctx.payload, lesson);
      }

      const fallbackTimeZone = resolveTimeZone(
        ctx.payload.config.admin.timezones.defaultTimezone
      );
      lesson.timeZone = await resolveTenantTimeZone(
        ctx.payload,
        effectiveTenantId,
        fallbackTimeZone
      );

      return lesson;
    }),

  getByIdForBooking: protectedProcedure
    .use(requireCollections("lessons"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));

      const lesson = await findByIdSafe<Lesson>(ctx.payload, "lessons", input.id, {
        depth: 5,
        overrideAccess: true,
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      if (tenantId == null) {
        tenantId = deriveTenantIdFromLesson(lesson);
      }
      if (tenantId) {
        assertLessonBelongsToTenant(lesson, tenantId, input.id);
        await populateLessonClassOption(ctx.payload, lesson);
      }

      const fallbackTimeZone = resolveTimeZone(
        ctx.payload.config.admin.timezones.defaultTimezone
      );
      lesson.timeZone = await resolveTenantTimeZone(
        ctx.payload,
        tenantId,
        fallbackTimeZone
      );

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

      // Allow "multipleBooked" to pass through without error
      // The booking page's postValidation will redirect to the manage page
      // This prevents server errors when users with 2+ bookings visit the booking page
      if (
        lesson.bookingStatus === "booked" ||
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

      // Validate remaining capacity - but allow access if the user has pending bookings
      // for this lesson so they can return to the page and complete payment
      if (lesson.remainingCapacity <= 0 || lesson.bookingStatus === "waitlist") {
        if (hasCollection(ctx.payload, "bookings")) {
          const userId = typeof ctx.user?.id === "string" ? parseInt(ctx.user.id, 10) : ctx.user?.id;
          if (userId && !Number.isNaN(userId)) {
            const userPending = await findSafe(ctx.payload, "bookings", {
              where: {
                and: [
                  { lesson: { equals: input.id } },
                  { user: { equals: userId } },
                  { status: { equals: "pending" } },
                ],
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            });
            if (userPending.docs.length > 0) {
              // User has pending bookings; allow through so they can complete checkout
              return lesson;
            }
          }
        }
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
      const lesson = await findByIdSafe<Lesson>(ctx.payload, "lessons", input.id, {
        depth: 2,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!lesson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Lesson with id ${input.id} not found`,
        });
      }

      const classOption = lesson.classOption as ClassOption;
      if (!classOption || classOption.type !== "child") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This lesson is not available for children bookings. Only lessons with child class options are allowed.",
        });
      }

      return lesson;
    }),

  getByDate: publicProcedure
    .use(requireCollections("lessons"))
    .input(z.object({
      date: z.string(),
      /** When provided (e.g. from root home page schedule block), filter lessons to this tenant. */
      tenantId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Prefer Better Auth session when configured (magic-link login uses this).
        // Fall back to Payload auth for apps that haven't enabled Better Auth.
        const user = ctx.betterAuth?.api?.getSession
          ? (await ctx.betterAuth.api.getSession({ headers: ctx.headers }))?.user ?? null
          : (await ctx.payload.auth({ headers: ctx.headers, canSetHeaders: false }))?.user ?? null;

        let tenantId: number | null = input.tenantId ?? null;
        if (tenantId == null) {
          tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
        }

        const fallbackTimeZone = resolveTimeZone(
          ctx.payload.config.admin.timezones.defaultTimezone
        );
        const timeZone = await resolveTenantTimeZone(
          ctx.payload,
          tenantId,
          fallbackTimeZone
        );
        const { startOfDay, endOfDay } = getDayBoundsInTimeZone(input.date, timeZone);

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
          // Avoid expensive per-viewer virtual fields (bookingStatus/remainingCapacity/bookings join)
          // in the schedule query path. We'll compute what schedule needs in a single batch below.
          // Type assertion: select shape is correct for apps with a lessons collection; apps
          // without lessons (e.g. boatyard-sauna) use a different Config so the inferred select
          // type doesn't include these fields. Runtime is correct when lessons exists.
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            lockOutTime: true,
            originalLockOutTime: true,
            location: true,
            instructor: true,
            classOption: true,
            tenant: true,
            active: true,
          } as SelectType,
        });

        const now = new Date();
        const lessonDocs = lessons.docs as any[];
        const lessonIds = lessonDocs.map((l) => l.id).filter(Boolean) as number[];

        // Helpers
        const getId = (value: any): number | null => {
          if (!value) return null;
          if (typeof value === "number") return value;
          if (typeof value === "string") {
            const n = parseInt(value, 10);
            return Number.isFinite(n) ? n : null;
          }
          if (typeof value === "object" && value !== null && "id" in value) {
            const n = (value as any).id;
            return typeof n === "number" ? n : typeof n === "string" ? parseInt(n, 10) : null;
          }
          return null;
        };

        const isLessonClosed = (startTime: string | undefined, lockOutTime: number | undefined) => {
          if (!startTime) return false;
          const start = new Date(startTime);
          const startMs = start.getTime();
          if (!Number.isFinite(startMs)) return false;
          // Once the session has started, it's closed.
          if (now.getTime() >= startMs) return true;
          // lockOutTime is minutes before start time.
          if (lockOutTime === undefined || lockOutTime === null) return false;
          if (lockOutTime === 0) return false;
          const lockOutDeadlineMs = startMs - lockOutTime * 60_000;
          return now.getTime() >= lockOutDeadlineMs;
        };

        // Batch-fetch bookings for all returned lessons (for capacity + viewer state).
        // Only confirmed and waiting - pending does not show "Modify Booking" (user goes to manage via postValidation redirect)
        const bookingsByLessonId: Map<number, any[]> = new Map();
        if (lessonIds.length > 0 && hasCollection(ctx.payload, "bookings")) {
          const bookingsResult = await ctx.payload.find({
            collection: "bookings" as CollectionSlug,
            where: {
              and: [
                { lesson: { in: lessonIds } },
                { status: { in: ["confirmed", "waiting"] } },
              ],
            },
            depth: 2, // needed for user.parentUser and lesson.tenant in some setups
            limit: 0,
            overrideAccess: true,
            req: queryOptions.req,
          });

          (bookingsResult.docs as any[]).forEach((b) => {
            const lid = getId(b.lesson);
            if (!lid) return;
            const existing = bookingsByLessonId.get(lid) ?? [];
            existing.push(b);
            bookingsByLessonId.set(lid, existing);
          });
        }

        // Trial eligibility check (one query) if needed.
        const viewerId = getId(user);
        const hasTrialableLesson = lessonDocs.some((l) => {
          const co = l.classOption as any;
          return (
            co?.paymentMethods?.allowedDropIn?.discountTiers?.some?.((t: any) => t?.type === "trial") ??
            false
          );
        });

        let viewerHasAnyConfirmedBooking = false;
        if (viewerId && hasTrialableLesson && hasCollection(ctx.payload, "bookings")) {
          try {
            const anyConfirmed = await ctx.payload.find({
              collection: "bookings" as CollectionSlug,
              where: {
                and: [
                  {
                    or: [
                      { user: { equals: viewerId } },
                      { "user.parentUser": { equals: viewerId } },
                    ],
                  },
                  { status: { equals: "confirmed" } },
                ],
              },
              depth: 0,
              limit: 1,
              overrideAccess: true,
              req: queryOptions.req,
            });
            viewerHasAnyConfirmedBooking = (anyConfirmed?.docs?.length ?? 0) > 0;
          } catch {
            // If this fails for any reason, fall back to non-trialable behavior.
            viewerHasAnyConfirmedBooking = false;
          }
        }

        return lessonDocs.map((lesson: any) => {
          const lessonId = getId(lesson.id)!;
          const classOption: any = lesson.classOption;
          const places: number | null = typeof classOption === "object" && classOption !== null
            ? getId(classOption.places) ?? (typeof classOption.places === "number" ? classOption.places : null)
            : null;
          const lockOutTime: number | undefined = typeof lesson.lockOutTime === "number" ? lesson.lockOutTime : undefined;

          const lessonBookings = bookingsByLessonId.get(lessonId) ?? [];
          const totalConfirmedCount = lessonBookings.filter((b) => b.status === "confirmed").length;
          const isFull = typeof places === "number" ? totalConfirmedCount >= places : false;

          const closed = isLessonClosed(lesson.startTime, lockOutTime);
          const availability: LessonScheduleState["availability"] =
            closed ? "closed" : isFull ? "full" : "open";

          const remainingCapacity =
            typeof places === "number" ? Math.max(0, places - totalConfirmedCount) : lesson.remainingCapacity ?? 0;

          // Viewer-specific booking lists (confirmed, waiting only - pending does not affect schedule CTA)
          const viewerConfirmedIds: number[] = [];
          const viewerWaitingIds: number[] = [];

          if (viewerId) {
            const isChildClass = classOption?.type === "child";
            for (const b of lessonBookings) {
              const bookingUser: any = b.user;
              const bookingUserId = getId(bookingUser);
              const bookingParentId = getId(
                typeof bookingUser === "object" && bookingUser !== null ? bookingUser.parentUser : null
              );
              const matchesViewer = isChildClass ? bookingParentId === viewerId : bookingUserId === viewerId;
              if (!matchesViewer) continue;

              if (b.status === "confirmed") {
                const bid = getId(b.id);
                if (bid) viewerConfirmedIds.push(bid);
              } else if (b.status === "waiting") {
                const bid = getId(b.id);
                if (bid) viewerWaitingIds.push(bid);
              }
            }
          }

          const viewerConfirmedCount = viewerConfirmedIds.length;
          const viewerWaitingCount = viewerWaitingIds.length;

          const scheduleState: LessonScheduleState = {
            availability,
            viewer: {
              confirmedIds: viewerConfirmedIds,
              confirmedCount: viewerConfirmedCount,
              waitingIds: viewerWaitingIds,
              waitingCount: viewerWaitingCount,
            },
            action: "loginToBook", // overwritten below
          };

          const isChildClass = classOption?.type === "child";
          const isTrialable =
            classOption?.paymentMethods?.allowedDropIn?.discountTiers?.some?.((t: any) => t?.type === "trial") ??
            false;
          const hasPaymentMethods = Boolean(
            classOption?.paymentMethods?.allowedDropIn ||
              (Array.isArray(classOption?.paymentMethods?.allowedPlans) &&
                classOption.paymentMethods.allowedPlans.length > 0)
          );

          const dropInAllowsMultiple =
            classOption?.paymentMethods?.allowedDropIn?.allowMultipleBookingsPerLesson === true;

          const planAllowsMultiple = Array.isArray(classOption?.paymentMethods?.allowedPlans)
            ? classOption.paymentMethods.allowedPlans.some((p: any) => {
                // Only opt-in to multi-booking for plans that explicitly allow it.
                // (Safer default: existing apps expecting single-slot bookings keep "Cancel Booking".)
                const si = p?.sessionsInformation;
                return si?.allowMultipleBookingsPerLesson === true;
              })
            : false;

          // If there are no payment methods, the flow is "no payment" and multi-booking is allowed
          // by capacity/booking rules. If there are payment methods, only show "Modify" when at
          // least one method supports multiple bookings per lesson.
          const allowsMultipleBookingsForViewer = !hasPaymentMethods || dropInAllowsMultiple || planAllowsMultiple;
          scheduleState.singleSlotOnly = !allowsMultipleBookingsForViewer;

          if (availability === "closed") {
            scheduleState.action = "closed";
            scheduleState.label = "Closed";
          } else if (!viewerId) {
            scheduleState.action = "loginToBook";
            scheduleState.label = isTrialable ? "Book Trial Class" : "Book";
          } else if (isChildClass) {
            scheduleState.action = "manageChildren";
            scheduleState.label = "Manage Children";
          } else if (viewerConfirmedCount >= 2) {
            scheduleState.action = "modify";
            scheduleState.label = "Modify Booking";
          } else if (viewerConfirmedCount === 1) {
            const canIncreaseQuantity = availability === "open" && remainingCapacity > 0 && allowsMultipleBookingsForViewer;
            if (canIncreaseQuantity) {
              scheduleState.action = "modify";
              scheduleState.label = "Modify Booking";
            } else {
              scheduleState.action = "cancel";
              scheduleState.label = "Cancel Booking";
            }
          } else if (viewerWaitingCount > 0) {
            scheduleState.action = "leaveWaitlist";
            scheduleState.label = "Leave Waitlist";
          } else if (availability === "full") {
            scheduleState.action = "joinWaitlist";
            scheduleState.label = "Join Waitlist";
          } else {
            scheduleState.action = "book";
            scheduleState.label = isTrialable && !viewerHasAnyConfirmedBooking ? "Book Trial Class" : "Book";
          }

          // Maintain legacy fields for compatibility with existing consumers.
          // bookingStatus here is derived from the computed schedule state rather than Payload hooks.
          const legacyBookingStatus: Lesson["bookingStatus"] =
            availability === "closed"
              ? "closed"
              : viewerConfirmedCount >= 2
                ? "multipleBooked"
                : viewerConfirmedCount >= 1
                  ? (isChildClass ? "childrenBooked" : "booked")
                  : viewerWaitingCount > 0
                    ? "waiting"
                    : availability === "full"
                      ? "waitlist"
                      : isTrialable && !viewerHasAnyConfirmedBooking
                        ? "trialable"
                        : "active";

          return {
            ...lesson,
            bookings: { docs: [] },
            remainingCapacity,
            bookingStatus: legacyBookingStatus,
            myBookingCount: viewerConfirmedCount,
            scheduleState,
            timeZone,
          } as Lesson;
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

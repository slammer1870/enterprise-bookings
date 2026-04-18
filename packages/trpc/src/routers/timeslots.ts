import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { CollectionSlug, SelectType } from "payload";

import { TRPCRouterRecord } from "@trpc/server";
import {
  protectedProcedure,
  publicProcedure,
  requireBookingCollections,
} from "../trpc";
import { findByIdSafe, findSafe, hasCollection } from "../utils/collections";
import {
  getTenantSlug,
  resolveTenantId,
  resolveTenantIdFromTimeslotId,
  resolveTenantTimeZone,
  assertTimeslotBelongsToTenant,
  populateTimeslotEventType,
  deriveTenantIdFromTimeslot,
} from "../utils/tenant";

import { EventType, Timeslot, TimeslotScheduleState, ScheduleTimeslot } from "@repo/shared-types";
import {
  checkRole,
  getDayRange,
  getDayBoundsInTimeZone,
  resolveTimeZone,
  sanitizeBetterAuthSession,
  sanitizeBetterAuthUser,
} from "@repo/shared-utils";

export const timeslotsRouter = {
  getById: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantSlug = getTenantSlug(ctx);
      let tenantId = await resolveTenantId(ctx.payload, tenantSlug);
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(ctx.payload, input.id, ctx.bookingsSlugs.timeslots);
      }

      // IMPORTANT: when operating on behalf of a user, enforce Payload access controls.
      // We pass req.context.tenant so multi-tenant access functions can scope correctly.
      const timeslot = (await ctx.payload
        .findByID({
          collection: ctx.bookingsSlugs.timeslots as any,
          id: input.id,
          depth: 3,
          overrideAccess: false,
          user: ctx.user,
          req: {
            user: ctx.user,
            payload: ctx.payload,
            context: tenantId ? { tenant: tenantId } : {},
          } as any,
        })
        .catch((e: any) => {
          if (e?.statusCode === 404 || e?.message?.includes?.("not found")) return null;
          throw e;
        })) as Timeslot | null;

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${input.id} not found`,
        });
      }

      let effectiveTenantId = tenantId;
      if (effectiveTenantId == null) {
        effectiveTenantId = deriveTenantIdFromTimeslot(timeslot);
      }

      if (effectiveTenantId) {
        assertTimeslotBelongsToTenant(timeslot, effectiveTenantId, input.id);
        await populateTimeslotEventType(ctx.payload, timeslot, ctx.bookingsSlugs.eventTypes);
      }

      const fallbackTimeZone = resolveTimeZone(
        ctx.payload.config.admin.timezones.defaultTimezone
      );
      timeslot.timeZone = await resolveTenantTimeZone(
        ctx.payload,
        effectiveTenantId,
        fallbackTimeZone
      );

      return timeslot;
    }),

  getByIdForBooking: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      // Match getById: when host/cookie cannot resolve a tenant (e.g. custom domain without
      // tenant-slug, or slug mismatch), derive tenant from the timeslot before findByID.
      // Otherwise req.context.tenant is empty, tenantScopedPublicReadStrict cannot scope the read,
      // and Payload returns 403 "You are not allowed to perform this action."
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(
          ctx.payload,
          input.id,
          ctx.bookingsSlugs.timeslots
        );
      }

      const timeslot = (await ctx.payload
        .findByID({
          collection: ctx.bookingsSlugs.timeslots as any,
          id: input.id,
          depth: 5,
          // Enforce access control for the caller, but provide tenant context for cross-tenant booking
          // (tenant is derived from host/cookie + validated below).
          overrideAccess: false,
          user: ctx.user,
          req: {
            user: ctx.user,
            payload: ctx.payload,
            headers: ctx.headers,
            context: tenantId ? { tenant: tenantId } : {},
          } as any,
        })
        .catch((e: any) => {
          if (e?.statusCode === 404 || e?.message?.includes?.("not found")) return null;
          throw e;
        })) as Timeslot | null;

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${input.id} not found`,
        });
      }

      if (tenantId == null) {
        tenantId = deriveTenantIdFromTimeslot(timeslot);
      }
      if (tenantId) {
        assertTimeslotBelongsToTenant(timeslot, tenantId, input.id);
        await populateTimeslotEventType(ctx.payload, timeslot, ctx.bookingsSlugs.eventTypes);
      }

      const fallbackTimeZone = resolveTimeZone(
        ctx.payload.config.admin.timezones.defaultTimezone
      );
      timeslot.timeZone = await resolveTenantTimeZone(
        ctx.payload,
        tenantId,
        fallbackTimeZone
      );

      // Validate timeslot is bookable
      // NOTE: `bookingStatus` is computed per-viewer:
      // - "booked"/"multipleBooked"/"childrenBooked" means *this user* already has a booking.
      // - "waitlist" means the class is full (for users who are not booked).
      if (timeslot.bookingStatus === "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This timeslot is no longer available for booking",
        });
      }

      // Allow "multipleBooked" to pass through without error
      // The booking page's postValidation will redirect to the manage page
      // This prevents server errors when users with 2+ bookings visit the booking page
      if (
        timeslot.bookingStatus === "booked" ||
        timeslot.bookingStatus === "childrenBooked"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already booked on this timeslot",
        });
      }

      if (timeslot.bookingStatus === "waiting") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already on the waitlist for this timeslot",
        });
      }

      // Validate remaining capacity - but allow access if the user has pending bookings
      // for this timeslot so they can return to the page and complete payment
      if (timeslot.remainingCapacity <= 0 || timeslot.bookingStatus === "waitlist") {
        if (hasCollection(ctx.payload, ctx.bookingsSlugs.bookings)) {
          const userId = typeof ctx.user?.id === "string" ? parseInt(ctx.user.id, 10) : ctx.user?.id;
          if (userId && !Number.isNaN(userId)) {
            const userPending = await findSafe(ctx.payload, ctx.bookingsSlugs.bookings, {
              where: {
                and: [
                  { timeslot: { equals: input.id } },
                  { user: { equals: userId } },
                  { status: { equals: "pending" } },
                ],
              },
              limit: 1,
              depth: 0,
              overrideAccess: false,
              user: ctx.user,
            });
            if (userPending.docs.length > 0) {
              // User has pending bookings; allow through so they can complete checkout
              return timeslot;
            }
          }
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This timeslot is fully booked",
        });
      }

      return timeslot;
    }),

  getByIdForChildren: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.id, {
        depth: 2,
        overrideAccess: false,
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${input.id} not found`,
        });
      }

      const eventType = timeslot.eventType as EventType;
      if (!eventType || eventType.type !== "child") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This timeslot is not available for children bookings. Only timeslots with child class options are allowed.",
        });
      }

      return timeslot;
    }),

  getByDate: publicProcedure
    .use(requireBookingCollections("timeslots"))
    .input(z.object({
      date: z.string(),
      /** When provided (e.g. from root home page schedule block), filter timeslots to this tenant. */
      tenantId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Prefer Better Auth session when configured (magic-link login uses this),
        // but degrade to a logged-out viewer when auth lookup throws (e.g. "No User").
      let user: any = ctx.user ?? null;
      if (!user && ctx.betterAuth?.api?.getSession) {
        try {
          const raw = await ctx.betterAuth.api.getSession({ headers: ctx.headers });
          user = sanitizeBetterAuthSession(raw)?.user ?? null;
        } catch {
          user = null;
        }
      } else if (!user) {
        try {
          const auth = await ctx.payload.auth({
            headers: ctx.headers,
            canSetHeaders: false,
          });
          user = sanitizeBetterAuthUser(auth.user);
        } catch {
          user = null;
        }
      }

        const tenantSlug = getTenantSlug(ctx);
        let tenantId: number | null = input.tenantId ?? null;
        if (tenantId == null) {
          tenantId = await resolveTenantId(ctx.payload, tenantSlug);
        }

        // When a tenant slug was provided but does not resolve, treat it as an empty schedule
        // instead of letting collection access turn this into a 403.
        if (tenantSlug && tenantId == null) {
          return [];
        }

        // Without tenant context, tenant-scoped apps should return an empty schedule
        // to avoid leaking cross-tenant data. Non-tenant apps should still return all timeslots.
        const hasTenantsCollection = hasCollection(ctx.payload, "tenants");
        if (tenantSlug == null && input.tenantId == null && tenantId == null && hasTenantsCollection) {
          return [];
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

        // Schedule UX: don't allow browsing past days, and don't show timeslots that already ended today.
        // Use Date.now so test suites can stub current time deterministically.
        const nowMs = Date.now();
        const { startOfDay: todayStart } = getDayBoundsInTimeZone(
          new Date(nowMs).toISOString(),
          timeZone
        );
        if (endOfDay.getTime() < todayStart.getTime()) {
          return [];
        }
        // Note: We intentionally do NOT filter out timeslots that already ended today.
        // Requirement: users shouldn't be able to browse yesterday or earlier, but
        // today's schedule should still show the full day.

        const dayRangeClause = {
          startTime: {
            greater_than_equal: startOfDay.toISOString(),
            less_than_equal: endOfDay.toISOString(),
          },
        };

        // Always filter out inactive timeslots at the query level.
        // When overrideAccess: true (below), timeslotsRead doesn't run so we must
        // apply the active constraint explicitly.
        const activeClause = { active: { equals: true } };

        const whereClause: any = tenantId
          ? {
              and: [
                dayRangeClause,
                activeClause,
                {
                  tenant: {
                    equals: tenantId,
                  },
                },
              ],
            }
          : {
              and: [dayRangeClause, activeClause],
            };

        const queryOptions: {
          where: any;
          depth: number;
          sort: string;
          overrideAccess: boolean;
          req?: any;
        } = {
          where: whereClause,
          // Keep timeslot query shallow; we will populate + sanitize eventType ourselves.
          depth: 0,
          sort: "startTime",
          // When tenantId is set, bypass Payload access controls and rely solely on the
          // explicit whereClause filters (tenant + active + day range). This prevents the
          // multi-tenant plugin's withTenantAccess wrapper from adding { tenant: { in: [] } }
          // for authenticated better-auth users whose session object lacks the `tenants`
          // relationship (it is not saved to the JWT). With overrideAccess: true the
          // timeslotsRead access function does not run, so we must supply the active filter
          // directly in whereClause (done above).
          overrideAccess: true,
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

        const timeslots = await ctx.payload.find({
          collection: ctx.bookingsSlugs.timeslots as CollectionSlug,
          where: queryOptions.where,
          depth: queryOptions.depth,
          sort: queryOptions.sort,
          overrideAccess: queryOptions.overrideAccess,
          req: queryOptions.req,
          // Avoid expensive per-viewer virtual fields (bookingStatus/remainingCapacity/bookings join)
          // in the schedule query path. We'll compute what schedule needs in a single batch below.
        // Type assertion: select shape is correct for applications with a timeslots collection.
        // For apps without timeslots, a different Config keeps inferred select types in sync.
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            lockOutTime: true,
            originalLockOutTime: true,
            location: true,
            staffMember: true,
            eventType: true,
            tenant: true,
            active: true,
          } as SelectType,
        });

        const timeslotDocs = timeslots.docs as any[];
        const timeslotIds = timeslotDocs.map((l) => l.id).filter(Boolean) as number[];

        // Sanitize relationship docs to prevent leaking tenant/payment/provider fields to clients.
        // We intentionally return tenant as an ID only (or null) and a schedule-safe eventType shape.
        const relationId = (value: any): number | null => {
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

        const sanitizeStaffMember = (doc: any) => {
          if (!doc || typeof doc !== "object") return null;
          return {
            id: relationId(doc.id) ?? 0,
            name: doc.name ?? null,
            profileImage:
              doc.profileImage && typeof doc.profileImage === "object" && doc.profileImage.url
                ? { url: doc.profileImage.url }
                : null,
          };
        };

        const sanitizeDropIn = (doc: any) => {
          if (!doc || typeof doc !== "object") return doc;
          return {
            id: relationId(doc.id),
            name: doc.name ?? null,
            description: doc.description ?? null,
            isActive: doc.isActive ?? null,
            price: doc.price ?? null,
            adjustable: doc.adjustable ?? null,
            discountTiers: Array.isArray(doc.discountTiers) ? doc.discountTiers : [],
            paymentMethods: Array.isArray(doc.paymentMethods) ? doc.paymentMethods : [],
          };
        };

        const sanitizePlan = (doc: any) => {
          if (!doc || typeof doc !== "object") return doc;
          const si = doc.sessionsInformation && typeof doc.sessionsInformation === "object"
            ? doc.sessionsInformation
            : null;
          const pi = doc.priceInformation && typeof doc.priceInformation === "object"
            ? doc.priceInformation
            : null;
          return {
            id: relationId(doc.id),
            name: doc.name ?? null,
            sessionsInformation: si
              ? {
                  sessions: si.sessions ?? null,
                  intervalCount: si.intervalCount ?? null,
                  interval: si.interval ?? null,
                  allowMultipleBookingsPerTimeslot: si.allowMultipleBookingsPerTimeslot ?? false,
                }
              : undefined,
            priceInformation: pi
              ? {
                  price: pi.price ?? null,
                  intervalCount: pi.intervalCount ?? null,
                  interval: pi.interval ?? null,
                }
              : undefined,
            status: doc.status ?? null,
          };
        };

        const sanitizeClassPassType = (doc: any) => {
          if (!doc || typeof doc !== "object") return doc;
          const pi = doc.priceInformation && typeof doc.priceInformation === "object"
            ? doc.priceInformation
            : null;
          return {
            id: relationId(doc.id),
            name: doc.name ?? null,
            slug: doc.slug ?? null,
            quantity: doc.quantity ?? null,
            allowMultipleBookingsPerTimeslot: doc.allowMultipleBookingsPerTimeslot ?? false,
            priceInformation: pi ? { price: pi.price ?? null } : undefined,
            status: doc.status ?? null,
          };
        };

        const sanitizeEventType = (doc: any) => {
          if (!doc || typeof doc !== "object") return doc;
          const pm = doc.paymentMethods && typeof doc.paymentMethods === "object" ? doc.paymentMethods : null;
          const allowedDropIn = pm?.allowedDropIn;
          return {
            id: relationId(doc.id),
            name: doc.name ?? null,
            places: doc.places ?? null,
            description: doc.description ?? null,
            type: doc.type ?? null,
            paymentMethods: pm
              ? {
                  allowedDropIn:
                    allowedDropIn && typeof allowedDropIn === "object"
                      ? sanitizeDropIn(allowedDropIn)
                      : allowedDropIn != null
                        ? relationId(allowedDropIn)
                        : null,
                  allowedClassPasses: Array.isArray(pm.allowedClassPasses)
                    ? pm.allowedClassPasses.map((cp: any) =>
                        cp && typeof cp === "object" ? sanitizeClassPassType(cp) : relationId(cp)
                      )
                    : [],
                  allowedPlans: Array.isArray(pm.allowedPlans)
                    ? pm.allowedPlans.map((p: any) =>
                        p && typeof p === "object" ? sanitizePlan(p) : relationId(p)
                      )
                    : [],
                }
              : undefined,
          };
        };

        // Populate staffMembers in one query so public schedule cards can still show
        // staffMember names and avatars without exposing extra staffMember fields.
        const staffMemberIds = Array.from(
          new Set(timeslotDocs.map((l) => relationId(l.staffMember)).filter(Boolean) as number[])
        );
        const staffMembersById: Map<number, any> = new Map();
        if (staffMemberIds.length > 0 && hasCollection(ctx.payload, ctx.bookingsSlugs.staffMembers)) {
          const staffMembers = await ctx.payload.find({
            collection: ctx.bookingsSlugs.staffMembers as CollectionSlug,
            where: { id: { in: staffMemberIds } },
            depth: 2,
            limit: 0,
            overrideAccess: false,
            req: queryOptions.req,
          });
          (staffMembers.docs as any[]).forEach((staffMember) => {
            const id = relationId(staffMember?.id);
            if (!id) return;
            staffMembersById.set(id, sanitizeStaffMember(staffMember));
          });
        }

        // Populate class options in one query (then sanitize).
        const eventTypeIds = Array.from(
          new Set(timeslotDocs.map((l) => relationId(l.eventType)).filter(Boolean) as number[])
        );
        const eventTypesById: Map<number, any> = new Map();
        if (eventTypeIds.length > 0 && hasCollection(ctx.payload, ctx.bookingsSlugs.eventTypes)) {
          const eventTypes = await ctx.payload.find({
            collection: ctx.bookingsSlugs.eventTypes as CollectionSlug,
            where: { id: { in: eventTypeIds } },
            depth: 2,
            limit: 0,
            overrideAccess: true,
            req: queryOptions.req,
          });
          (eventTypes.docs as any[]).forEach((co) => {
            const id = relationId(co?.id);
            if (!id) return;
            eventTypesById.set(id, sanitizeEventType(co));
          });
        }

        // Helpers
        const getId = relationId;
        const nowForStatus = new Date(nowMs);

        const isTimeslotClosed = (startTime: string | undefined, lockOutTime: number | undefined) => {
          if (!startTime) return false;
          const start = new Date(startTime);
          const startMs = start.getTime();
          if (!Number.isFinite(startMs)) return false;
          // Once the session has started, it's closed.
          if (nowForStatus.getTime() >= startMs) return true;
          // lockOutTime is minutes before start time.
          if (lockOutTime === undefined || lockOutTime === null) return false;
          if (lockOutTime === 0) return false;
          const lockOutDeadlineMs = startMs - lockOutTime * 60_000;
          return nowForStatus.getTime() >= lockOutDeadlineMs;
        };

        // Batch-fetch bookings for all returned timeslots (for capacity + viewer state).
        // Only confirmed and waiting - pending does not show "Modify Booking" (user goes to manage via postValidation redirect)
        const bookingsByTimeslotId: Map<number, any[]> = new Map();
        if (timeslotIds.length > 0 && hasCollection(ctx.payload, ctx.bookingsSlugs.bookings)) {
          const bookingsResult = await ctx.payload.find({
            collection: ctx.bookingsSlugs.bookings as CollectionSlug,
            where: {
              and: [
                { timeslot: { in: timeslotIds } },
                { status: { in: ["confirmed", "waiting"] } },
              ],
            },
            depth: 2, // needed for user.parentUser and timeslot.tenant in some setups
            limit: 0,
            overrideAccess: true,
            req: queryOptions.req,
          });

          (bookingsResult.docs as any[]).forEach((b) => {
            const lid = getId(b.timeslot);
            if (!lid) return;
            const existing = bookingsByTimeslotId.get(lid) ?? [];
            existing.push(b);
            bookingsByTimeslotId.set(lid, existing);
          });
        }

        // Trial eligibility check (one query) if needed.
        const viewerId = getId(user);
        const hasTrialableTimeslot = timeslotDocs.some((l) => {
          const co = l.eventType as any;
          return (
            co?.paymentMethods?.allowedDropIn?.discountTiers?.some?.((t: any) => t?.type === "trial") ??
            false
          );
        });

        let viewerHasAnyConfirmedBooking = false;
        if (viewerId && hasTrialableTimeslot && hasCollection(ctx.payload, ctx.bookingsSlugs.bookings)) {
          try {
            const anyConfirmed = await ctx.payload.find({
              collection: ctx.bookingsSlugs.bookings as CollectionSlug,
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

        return timeslotDocs.map((timeslot: any) => {
          const timeslotId = getId(timeslot.id)!;
          const staffMemberId = getId(timeslot.staffMember);
          const staffMember =
            (staffMemberId != null ? staffMembersById.get(staffMemberId) : null) ?? null;
          const eventTypeId = getId(timeslot.eventType);
          const eventType: any =
            (eventTypeId != null ? eventTypesById.get(eventTypeId) : null) ?? null;
          const places: number | null =
            typeof eventType === "object" && eventType !== null
              ? (typeof eventType.places === "number" ? eventType.places : null)
              : null;
          const lockOutTime: number | undefined = typeof timeslot.lockOutTime === "number" ? timeslot.lockOutTime : undefined;

          const timeslotBookings = bookingsByTimeslotId.get(timeslotId) ?? [];
          const totalConfirmedCount = timeslotBookings.filter((b) => b.status === "confirmed").length;
          const isFull = typeof places === "number" ? totalConfirmedCount >= places : false;

          const closed = isTimeslotClosed(timeslot.startTime, lockOutTime);
          const availability: TimeslotScheduleState["availability"] =
            closed ? "closed" : isFull ? "full" : "open";

          const remainingCapacity =
            typeof places === "number" ? Math.max(0, places - totalConfirmedCount) : timeslot.remainingCapacity ?? 0;

          // Viewer-specific booking lists (confirmed, waiting only - pending does not affect schedule CTA)
          const viewerConfirmedIds: number[] = [];
          const viewerWaitingIds: number[] = [];

          if (viewerId) {
            const isChildClass = eventType?.type === "child";
            for (const b of timeslotBookings) {
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

          const scheduleState: TimeslotScheduleState = {
            availability,
            viewer: {
              confirmedIds: viewerConfirmedIds,
              confirmedCount: viewerConfirmedCount,
              waitingIds: viewerWaitingIds,
              waitingCount: viewerWaitingCount,
            },
            action: "loginToBook", // overwritten below
          };

          const isChildClass = eventType?.type === "child";
          const isTrialable =
            eventType?.paymentMethods?.allowedDropIn?.discountTiers?.some?.((t: any) => t?.type === "trial") ??
            false;
          const hasPaymentMethods = Boolean(
            eventType?.paymentMethods?.allowedDropIn ||
              (Array.isArray(eventType?.paymentMethods?.allowedPlans) &&
                eventType.paymentMethods.allowedPlans.length > 0)
          );

          const dropInAllowsMultiple =
            eventType?.paymentMethods?.allowedDropIn?.allowMultipleBookingsPerTimeslot === true;

          const planAllowsMultiple = Array.isArray(eventType?.paymentMethods?.allowedPlans)
            ? eventType.paymentMethods.allowedPlans.some((p: any) => {
                // Only opt-in to multi-booking for plans that explicitly allow it.
                // (Safer default: existing apps expecting single-slot bookings keep "Cancel Booking".)
                const si = p?.sessionsInformation;
                return si?.allowMultipleBookingsPerTimeslot === true;
              })
            : false;

          // If there are no payment methods, the flow is "no payment" and multi-booking is allowed
          // by capacity/booking rules. If there are payment methods, only show "Modify" when at
          // least one method supports multiple bookings per timeslot.
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
          const legacyBookingStatus: Timeslot["bookingStatus"] =
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

          const scheduleTimeslot: ScheduleTimeslot = {
            id: timeslotId,
            date: timeslot.date,
            startTime: timeslot.startTime,
            endTime: timeslot.endTime,
            location: timeslot.location ?? "",
            staffMember,
            tenant: getId(timeslot.tenant),
            eventType: {
              id: getId(eventType?.id) ?? (typeof eventType?.id === "number" ? eventType.id : timeslotId),
              name: eventType?.name ?? "",
              type: eventType?.type ?? undefined,
            },
            remainingCapacity,
            bookingStatus: legacyBookingStatus,
            myBookingCount: viewerConfirmedCount,
            scheduleState,
            timeZone,
          };

          return scheduleTimeslot;
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
            error instanceof Error ? error.message : "Failed to fetch timeslots",
          cause: error,
        });
      }
    }),
  getForKiosk: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .query(async ({ ctx }) => {
      if (!checkRole(["super-admin"], ctx.user as any)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const { endOfDay } = getDayRange(new Date());

      const timeslots = await findSafe(ctx.payload, ctx.bookingsSlugs.timeslots, {
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

      return timeslots.docs.map((timeslot: any) => timeslot as Timeslot);
    }),
} satisfies TRPCRouterRecord;

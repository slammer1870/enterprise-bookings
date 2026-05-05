import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRPCRouterRecord } from "@trpc/server";
import type Stripe from "stripe";
import { protectedProcedure, requireBookingCollections, requireCollections } from "../trpc";
import { findByIdSafe, findSafe, createSafe, updateSafe, hasCollection } from "../utils/collections";
import {
  getTenantSlug,
  resolveTenantId,
  resolveTenantIdFromTimeslotId,
  assertTimeslotBelongsToTenant,
  getDocTenantId,
  populateTimeslotEventType,
  createPayloadLocalReqFromTrpc,
  deriveTenantIdFromTimeslot,
} from "../utils/tenant";

import { Booking, EventType, Timeslot, TimeslotScheduleState, Subscription } from "@repo/shared-types";
import { checkRole, stripe } from "@repo/shared-utils";
import {
  getMaxSubscriptionQuantityPerTimeslot,
  hasReachedSubscriptionLimit,
  getRemainingSessionsInPeriod,
  canUseSubscriptionForBooking,
  filterValidClassPassesForTimeslot,
  type TimeslotLike,
  type ClassPassLike,
} from "@repo/shared-services";

export const bookingsRouter = {
  /**
   * Schedule UX shortcut for single-slot timeslots:
   * - If viewer has an eligible active subscription for the timeslot, book immediately.
   * - Otherwise redirect to the timeslot booking page so payment/subscription options are available.
   *
   * This intentionally avoids navigating to the generic booking page for cases where the
   * viewer can only ever book 1 slot and the flow is decided by membership state.
   */
  bookSingleSlotTimeslotOrRedirect: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings", "eventTypes"))
    .use(requireCollections("subscriptions"))
    .input(z.object({ timeslotId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { timeslotId } = input;

      // Load timeslot with overrideAccess first: production hosts (custom domains, proxies) often
      // omit tenant cookies / Host-derived slug, so tenantScopedPublicReadStrict would deny reads
      // when overrideAccess is false. This procedure is authenticated and user-scoped; we derive
      // tenant from the document and assert against host tenant when both exist.
      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, timeslotId, {
        depth: 2,
        overrideAccess: true,
        user: ctx.user,
      });
      if (!timeslot) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Timeslot with id ${timeslotId} not found` });
      }

      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = deriveTenantIdFromTimeslot(timeslot);
      }

      const payloadReq = createPayloadLocalReqFromTrpc({
        payload: ctx.payload,
        user: ctx.user,
        headers: ctx.headers,
        tenantId,
      });

      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, timeslotId);

      const eventTypeId =
        typeof timeslot.eventType === "object" && timeslot.eventType !== null
          ? (timeslot.eventType as any).id
          : (timeslot.eventType as any);
      const eventType =
        typeof timeslot.eventType === "object" && timeslot.eventType !== null
          ? (timeslot.eventType as any)
          : eventTypeId != null
            ? await findByIdSafe<EventType>(ctx.payload, ctx.bookingsSlugs.eventTypes, eventTypeId, {
                depth: 2,
                overrideAccess: true,
                user: ctx.user,
                req: payloadReq,
              })
            : null;

      // Child timeslots are handled on the children booking page.
      if ((eventType as any)?.type === "child") {
        return { redirectUrl: `/bookings/children/${timeslotId}` };
      }

      const paymentMethods = (eventType as any)?.paymentMethods as
        | { allowedDropIn?: any; allowedPlans?: any[] }
        | undefined;
      const hasPaymentMethods = Boolean(
        paymentMethods?.allowedDropIn || (paymentMethods?.allowedPlans?.length ?? 0) > 0
      );
      const dropInAllowsMultiple =
        (paymentMethods as any)?.allowedDropIn?.allowMultipleBookingsPerTimeslot === true;
      const planAllowsMultiple = Array.isArray((paymentMethods as any)?.allowedPlans)
        ? (paymentMethods as any).allowedPlans.some(
            (p: any) => p?.sessionsInformation?.allowMultipleBookingsPerTimeslot === true
          )
        : false;
      const allowsMultipleBookingsForViewer = !hasPaymentMethods || dropInAllowsMultiple || planAllowsMultiple;
      const singleSlotOnly = !allowsMultipleBookingsForViewer;

      // If this isn't a single-slot timeslot, fall back to the normal booking page flow.
      if (!singleSlotOnly) {
        return { redirectUrl: `/bookings/${timeslotId}` };
      }

      // If already booked, no-op (stay on schedule).
      const existingConfirmed = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          and: [
            { timeslot: { equals: timeslotId } },
            { user: { equals: ctx.user.id } },
            { status: { equals: "confirmed" } },
          ],
        },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        user: ctx.user,
        req: payloadReq,
      });
      if (existingConfirmed.docs.length > 0) {
        return { redirectUrl: null };
      }

      const allowedPlanIds =
        (paymentMethods as any)?.allowedPlans?.map((p: any) =>
          typeof p === "object" && p != null ? p.id : p
        ) ?? [];

      // No membership option configured -> redirect to manage.
      if (!Array.isArray(allowedPlanIds) || allowedPlanIds.length === 0) {
        return { redirectUrl: `/bookings/${timeslotId}` };
      }

      // Find the first eligible subscription the viewer can use for this timeslot.
      const subs = await findSafe<Subscription>(ctx.payload, "subscriptions", {
        where: {
          and: [
            { user: { equals: ctx.user.id } },
            { plan: { in: allowedPlanIds } },
          ],
        },
        depth: 2,
        limit: 25,
        overrideAccess: true,
        user: ctx.user,
        req: payloadReq,
      });

      const timeslotStart = new Date(timeslot.startTime);
      const usable = subs.docs.find((s: any) => canUseSubscriptionForBooking(s?.status));

      if (!usable) {
        return { redirectUrl: `/bookings/${timeslotId}` };
      }

      const limitReached = await hasReachedSubscriptionLimit(usable as any, ctx.payload, timeslotStart);
      if (limitReached) {
        return { redirectUrl: `/bookings/${timeslotId}/manage` };
      }

      // Book directly (mark as subscription-backed). Capacity and subscription were validated above.
      await createSafe(
        ctx.payload,
        "bookings",
        ({
          timeslot: Number(timeslotId),
          user: Number(ctx.user.id),
          status: "confirmed",
          paymentMethodUsed: "subscription",
          subscriptionIdUsed: Number((usable as any).id),
        } as unknown) as Record<string, unknown>,
        { overrideAccess: true }
      );

      return { redirectUrl: null };
    }),
  checkIn: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .input(z.object({ timeslotId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { timeslotId } = input;
      const tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, timeslotId, {
        depth: 3,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${timeslotId} not found`,
        });
      }
      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, timeslotId);

      const timeslotTenantId = deriveTenantIdFromTimeslot(timeslot);

      // Business Logic: Handle children's timeslots differently
      if (timeslot.eventType.type === "child") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "REDIRECT_TO_CHILDREN_BOOKING",
          cause: { redirectUrl: `/bookings/children/${timeslotId}` },
        });
      }

      // Try to create/update booking - this will use existing access controls
      // which handle membership validation, subscription limits, etc.
      try {
        const existingBooking = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            timeslot: { equals: timeslotId },
            user: { equals: ctx.user.id },
            ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
          },
          depth: 2,
          limit: 1,
          overrideAccess: true,
        });

        if (existingBooking.docs.length === 0) {
          // Create new booking (coerce IDs to number for Payload relationship fields)
          return await createSafe(ctx.payload, "bookings", {
            timeslot: Number(timeslotId),
            user: Number(ctx.user.id),
            status: "confirmed",
          }, {
            overrideAccess: true,
            user: ctx.user,
          });
        } else {
          // Update existing booking
          return await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
            status: "confirmed",
          }, {
            overrideAccess: true,
            user: ctx.user,
          });
        }
      } catch (error: any) {
        // If booking creation/update fails due to membership/payment issues
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "REDIRECT_TO_BOOKING_PAYMENT",
          cause: {
            redirectUrl: `/bookings/${timeslotId}`,
            originalError: error.message,
          },
        });
      }
    }),
  kioskCreateOrConfirmBooking: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .use(requireCollections("bookings", "users"))
    .input(z.object({ timeslotId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<Booking> => {
      // Kiosk is an admin-only flow: an admin checks a user into a timeslot.
      if (!checkRole(["admin"], ctx.user as any)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }

      const selectedUser = await findByIdSafe<any>(
        ctx.payload,
        "users",
        input.userId,
        {
          depth: 2,
          overrideAccess: true,
        }
      );

      if (!selectedUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User with id ${input.userId} not found`,
        });
      }

      const kioskTimeslot = await findByIdSafe<Timeslot>(
        ctx.payload,
        ctx.bookingsSlugs.timeslots,
        input.timeslotId,
        { depth: 0, overrideAccess: true }
      );
      const kioskTenantId = kioskTimeslot ? deriveTenantIdFromTimeslot(kioskTimeslot) : null;

      // Look up an existing booking using the admin context (read access).
      const existingBooking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.timeslotId },
          user: { equals: input.userId },
          ...(kioskTenantId != null ? { tenant: { equals: kioskTenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      });

      // Create/update using the selected user context so existing access controls run
      // as if that user is making the booking (membership checks, child-parent logic, etc.).
      if (existingBooking.docs.length > 0) {
        const updated = await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
          status: "confirmed",
        }, {
          overrideAccess: true,
          user: selectedUser,
        });
        return updated as Booking;
      }

      const created = await createSafe<Booking>(ctx.payload, "bookings", {
        timeslot: Number(input.timeslotId),
        user: Number(input.userId),
        status: "confirmed",
      }, {
        overrideAccess: true,
        user: selectedUser,
      });

      return created as Booking;
    }),
  createBooking: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .use(requireCollections("subscriptions", "users"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.id, {
        depth: 3,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${input.id} not found`,
        });
      }
      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, input.id);

      const booking = await createSafe<Booking>(ctx.payload, "bookings", {
        timeslot: Number(input.id),
        user: Number(ctx.user.id),
        status: "confirmed",
      }, {
        overrideAccess: true,
        user: ctx.user,
      });

      return booking;
    }),
  createBookings: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .use(requireCollections("subscriptions"))
    .input(
      z.object({
        timeslotId: z.number(),
        quantity: z.number().min(1),
        status: z.enum(["confirmed", "pending"]).optional(),
        /** When provided, bookings are created as confirmed using this subscription (no payment). */
        subscriptionId: z.number().optional(),
        /** When provided with subscriptionId, these pending booking IDs are confirmed (updated) instead of creating new ones. */
        pendingBookingIds: z.array(z.number()).optional(),
        /** When provided, bookings are created as confirmed using this class pass (no payment). */
        classPassId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<Booking[]> => {
      const { timeslotId, quantity, status: statusInput, subscriptionId, pendingBookingIds, classPassId } = input;
      const status =
        subscriptionId != null || classPassId != null ? "confirmed" : (statusInput ?? "confirmed");
      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(ctx.payload, timeslotId, ctx.bookingsSlugs.timeslots);
      }

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, timeslotId, {
        depth: 0,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${timeslotId} not found`,
        });
      }
      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, timeslotId);

      const timeslotTenantId = deriveTenantIdFromTimeslot(timeslot);

      // Business eligibility for booking creation (including "pending" bookings for checkout).
      // UI may mark the timeslot as closed after startTime, but we still allow users to
      // create bookings until endTime so late arrivals can complete booking via link.
      const now = new Date();
      const end = new Date(timeslot.endTime);
      const endMs = end.getTime();
      const lockOutTime =
        typeof (timeslot as any).lockOutTime === "number" ? (timeslot as any).lockOutTime : 0;

      const creationClosed =
        Number.isFinite(endMs) &&
        (now.getTime() >= endMs ||
          (lockOutTime > 0 && now.getTime() >= endMs - lockOutTime * 60_000));

      if (creationClosed) {
        // Late-completion bypass:
        // If the user already has a pending/waiting booking for this timeslot,
        // allow them to complete their booking even if the timeslot endTime has passed.
        const viewerIdRaw: any = (ctx.user as any)?.id;
        const viewerId =
          typeof viewerIdRaw === "string" ? parseInt(viewerIdRaw, 10) : viewerIdRaw;
        const hasPendingOrWaiting = Number.isFinite(viewerId)
          ? (
              await ctx.payload.find({
                collection: ctx.bookingsSlugs.bookings as any,
                where: {
                  and: [
                    { timeslot: { equals: timeslotId } },
                    { user: { equals: viewerId } },
                    { status: { in: ["pending", "waiting"] } },
                    ...(timeslotTenantId != null ? [{ tenant: { equals: timeslotTenantId } }] : []),
                  ],
                },
                depth: 0,
                limit: 1,
                overrideAccess: true,
              })
            ).totalDocs > 0
          : false;

        if (!hasPendingOrWaiting) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Timeslot is closed" });
        }
      }

      // Only load a fully populated eventType if we need its payment method config.
      if ((subscriptionId != null || classPassId != null) && hasCollection(ctx.payload, ctx.bookingsSlugs.eventTypes)) {
        const co = timeslot.eventType as any;
        const coId = typeof co === "object" && co != null ? co.id : co;
        const needsFetch =
          typeof co !== "object" ||
          co == null ||
          (typeof co === "object" && co != null && (co as any).paymentMethods === undefined);

        if (coId != null && needsFetch) {
          const populated = await findByIdSafe<EventType>(ctx.payload, ctx.bookingsSlugs.eventTypes, coId, {
            depth: 2,
            overrideAccess: Boolean(tenantId),
            user: ctx.user,
          });
          if (populated) {
            (timeslot as any).eventType = populated as any;
          }
        }
      }

      // Validate quantity against remaining capacity
      const maxQuantity = Math.max(1, timeslot.remainingCapacity || 1);
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

      let paymentMethodUsed: "subscription" | "class_pass" | undefined;
      let subscriptionIdUsed: number | undefined;

      if (subscriptionId != null) {
        if (status !== "confirmed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Booking with subscription must be confirmed.",
          });
        }
        const allowedPlanIds =
          (timeslot.eventType as EventType)?.paymentMethods?.allowedPlans?.map(
            (p: { id?: number }) => (typeof p === "object" && p != null ? p.id : p)
          ) ?? [];
        if (!allowedPlanIds?.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This timeslot does not allow membership booking.",
          });
        }
        const subResult = await findSafe<Subscription>(
          ctx.payload,
          "subscriptions",
          {
            where: {
              id: { equals: subscriptionId },
              user: { equals: ctx.user.id },
              plan: { in: allowedPlanIds },
              ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
            },
            limit: 1,
            depth: 2,
            overrideAccess: true,
          }
        );
        const subscription = subResult.docs[0];
        if (!subscription) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or unauthorized subscription for this timeslot.",
          });
        }
        if (!canUseSubscriptionForBooking(subscription.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Your membership payment is past due. Please update payment in the customer portal.",
          });
        }
        const limitReached = await hasReachedSubscriptionLimit(
          subscription,
          ctx.payload,
          new Date(timeslot.startTime)
        );
        if (limitReached) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You have reached your membership session limit for this period.",
          });
        }
        const remaining = await getRemainingSessionsInPeriod(
          subscription,
          ctx.payload,
          new Date(timeslot.startTime)
        );
        if (remaining != null && remaining < quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `You have ${remaining} session${remaining === 1 ? "" : "s"} left this period. Reduce quantity or use another payment method.`,
          });
        }
        paymentMethodUsed = "subscription";
        subscriptionIdUsed = subscriptionId;
      }

      let classPassIdUsed: number | undefined;
      if (classPassId != null) {
        if (status !== "confirmed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Booking with class pass must be confirmed.",
          });
        }
        if (!hasCollection(ctx.payload, "class-passes")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Class passes are not available in this application.",
          });
        }
        const eventTypeWithPasses = timeslot.eventType as EventType & {
          paymentMethods?: { allowedClassPasses?: (number | { id: number })[] };
        };
        const allowedTypeIds =
          eventTypeWithPasses?.paymentMethods?.allowedClassPasses?.map(
            (p: { id?: number } | number) =>
              typeof p === "object" && p != null && "id" in p ? p.id : p
          ) ?? [];
        if (allowedTypeIds.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This timeslot does not allow class pass booking.",
          });
        }
        if (timeslotTenantId == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Timeslot has no tenant.",
          });
        }
        const passResult = await findSafe(
          ctx.payload,
          "class-passes",
          {
            where: {
              id: { equals: classPassId },
              user: { equals: ctx.user.id },
              tenant: { equals: timeslotTenantId },
              type: { in: allowedTypeIds },
              status: { equals: "active" },
              quantity: { greater_than: 0 },
              expirationDate: { greater_than: new Date().toISOString() },
            },
            limit: 1,
            depth: 2,
            overrideAccess: true,
          }
        );
        const passDoc = passResult.docs[0] as
          | {
              id: number;
              quantity: number;
              type?: number | { id: number; allowMultipleBookingsPerTimeslot?: boolean };
            }
          | undefined;
        if (!passDoc) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or unauthorized class pass for this timeslot.",
          });
        }
        const passTypeId =
          typeof passDoc.type === "object" && passDoc.type != null
            ? (passDoc.type as { id: number }).id
            : passDoc.type;
        let passType: { allowMultipleBookingsPerTimeslot?: boolean } | null = null;
        if (passTypeId != null && hasCollection(ctx.payload, "class-pass-types")) {
          const typeDoc = await findByIdSafe(
            ctx.payload,
            "class-pass-types",
            passTypeId,
            { depth: 0, overrideAccess: true }
          );
          passType = typeDoc as { allowMultipleBookingsPerTimeslot?: boolean } | null;
        }
        const allowMultiple = passType?.allowMultipleBookingsPerTimeslot === true;
        if (quantity > 1 && !allowMultiple) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This class pass allows only one slot per timeslot. Reduce quantity to 1 or use a different pass.",
          });
        }
        if (passDoc.quantity < quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Not enough credits on this pass. You have ${passDoc.quantity}; need ${quantity}.`,
          });
        }
        paymentMethodUsed = "class_pass";
        classPassIdUsed = classPassId;
      }

      // When booking via subscription (status confirmed), enforce allowMultipleBookingsPerTimeslot
      if (status === "confirmed") {
        const maxSubQty = await getMaxSubscriptionQuantityPerTimeslot(
          Number(ctx.user.id),
          timeslot,
          ctx.payload
        );
        if (maxSubQty != null && quantity > maxSubQty) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              maxSubQty === 0
                ? "You already have a booking for this timeslot. Your membership allows one slot per timeslot."
                : `Your membership allows at most ${maxSubQty} slot${maxSubQty !== 1 ? "s" : ""} per timeslot for this plan.`,
          });
        }
      }

      const decrementClassPassCredits = async (count: number) => {
        if (classPassIdUsed == null || count <= 0) return;
        const pass = (await ctx.payload.findByID({
          collection: "class-passes" as import("payload").CollectionSlug,
          id: classPassIdUsed,
          depth: 0,
          // System operation: class pass decrement is enforced by earlier ownership checks,
          // but users typically cannot update class passes directly.
          overrideAccess: true,
        })) as { quantity?: number; status?: string } | null;
        if (!pass || typeof pass.quantity !== "number") return;

        const nextQty = Math.max(0, pass.quantity - count);
        const nextStatus = nextQty === 0 ? "used" : (pass.status ?? "active");
        await ctx.payload.update({
          collection: "class-passes" as import("payload").CollectionSlug,
          id: classPassIdUsed,
          data: { quantity: nextQty, status: nextStatus } as Record<string, unknown>,
          overrideAccess: true,
        });
      };

      // When subscriptionId or classPassId + pendingBookingIds are provided, confirm those pending bookings instead of creating new ones
      const confirmedBookings: Booking[] = [];
      const confirmPendingWithClassPass =
        classPassId != null &&
        pendingBookingIds != null &&
        pendingBookingIds.length > 0 &&
        paymentMethodUsed === "class_pass" &&
        classPassIdUsed != null;

      if (
        subscriptionId != null &&
        pendingBookingIds != null &&
        pendingBookingIds.length > 0 &&
        paymentMethodUsed === "subscription" &&
        subscriptionIdUsed != null
      ) {
        if (pendingBookingIds.length > quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "pendingBookingIds count cannot exceed quantity.",
          });
        }
        const pendingResult = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            id: { in: pendingBookingIds },
            timeslot: { equals: timeslotId },
            user: { equals: ctx.user.id },
            status: { equals: "pending" },
            ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
          },
          limit: pendingBookingIds.length + 1,
          depth: 1,
          overrideAccess: true,
        });
        if (pendingResult.docs.length !== pendingBookingIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or unauthorized pending bookings for this timeslot.",
          });
        }
        for (const doc of pendingResult.docs) {
          const id = doc.id as number;
          const updated = await updateSafe<Booking>(
            ctx.payload,
            "bookings",
            id,
            {
              status: "confirmed",
              paymentMethodUsed: "subscription",
              subscriptionIdUsed,
            } as Partial<Booking>,
            // System operation: confirming pending bookings after membership selection.
            // Ownership was validated by the pendingResult query above.
            { overrideAccess: true }
          );
          confirmedBookings.push(updated as Booking);
          if (hasCollection(ctx.payload, "transactions")) {
            const existingTx = await ctx.payload.find({
              collection: "transactions" as import("payload").CollectionSlug,
              where: { booking: { equals: id } },
              limit: 1,
              overrideAccess: true,
            });
            if (existingTx.totalDocs === 0) {
              await ctx.payload.create({
                collection: "transactions" as import("payload").CollectionSlug,
                data: {
                  booking: id,
                  paymentMethod: "subscription",
                  subscriptionId: subscriptionIdUsed,
                  ...(timeslotTenantId != null ? { tenant: timeslotTenantId } : {}),
                } as Record<string, unknown>,
                overrideAccess: true,
              });
            }
          }
        }
      }

      if (confirmPendingWithClassPass) {
        if (pendingBookingIds!.length > quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "pendingBookingIds count cannot exceed quantity.",
          });
        }
        const pendingResult = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            id: { in: pendingBookingIds! },
            timeslot: { equals: timeslotId },
            user: { equals: ctx.user.id },
            status: { equals: "pending" },
            ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
          },
          limit: pendingBookingIds!.length + 1,
          depth: 1,
          overrideAccess: true,
        });
        if (pendingResult.docs.length !== pendingBookingIds!.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid or unauthorized pending bookings for this timeslot.",
          });
        }
        for (const doc of pendingResult.docs) {
          const id = doc.id as number;
          const updated = await updateSafe<Booking>(
            ctx.payload,
            "bookings",
            id,
            {
              status: "confirmed",
              paymentMethodUsed: "class_pass",
              classPassIdUsed: classPassIdUsed!,
            } as Partial<Booking>,
            // System operation: confirming pending bookings after selecting a class pass.
            // Ownership was validated by the pendingResult query above.
            { overrideAccess: true }
          );
          confirmedBookings.push(updated as Booking);
          if (hasCollection(ctx.payload, "transactions")) {
            const existingTx = await ctx.payload.find({
              collection: "transactions" as import("payload").CollectionSlug,
              where: { booking: { equals: id } },
              limit: 1,
              overrideAccess: true,
            });
            if (existingTx.totalDocs === 0) {
              await ctx.payload.create({
                collection: "transactions" as import("payload").CollectionSlug,
                data: {
                  booking: id,
                  paymentMethod: "class_pass",
                  classPassId: classPassIdUsed!,
                  ...(timeslotTenantId != null ? { tenant: timeslotTenantId } : {}),
                } as Record<string, unknown>,
                overrideAccess: true,
              });
            }
          }
        }
        await decrementClassPassCredits(confirmedBookings.length);
      }

      // Create any additional new bookings (when not confirming pending, or quantity > pendingBookingIds.length)
      const createCount =
        confirmedBookings.length > 0 ? quantity - confirmedBookings.length : quantity;
      const baseData: Record<string, unknown> = {
        timeslot: Number(timeslotId),
        user: Number(ctx.user.id),
        status: status,
      };
      if (paymentMethodUsed) (baseData as any).paymentMethodUsed = paymentMethodUsed;
      if (subscriptionIdUsed != null) (baseData as any).subscriptionIdUsed = subscriptionIdUsed;
      if (classPassIdUsed != null) (baseData as any).classPassIdUsed = classPassIdUsed;

      const shouldSkipSideEffects = status === "pending";
      for (let i = 0; i < createCount; i++) {
        const booking = await createSafe<Booking>(
          ctx.payload,
          "bookings",
          baseData,
          {
            // Access and capacity have already been validated in this mutation using the
            // authenticated user and tenant-scoped timeslot lookup above. Create with
            // elevated access so pending manage-flow bookings are not rejected by
            // collection access during this server-side operation.
            overrideAccess: true,
            context: shouldSkipSideEffects ? { skipBookingSideEffects: true } : undefined,
          }
        );
        confirmedBookings.push(booking as Booking);
        // Create transaction for class_pass so decrement hook can find it; also decrement
        // immediately for newly created confirmed bookings in this flow.
        if (
          paymentMethodUsed === "class_pass" &&
          classPassIdUsed != null &&
          hasCollection(ctx.payload, "transactions")
        ) {
          const bookingId = (booking as { id: number }).id;
          const existingTx = await ctx.payload.find({
            collection: "transactions" as import("payload").CollectionSlug,
            where: { booking: { equals: bookingId } },
            limit: 1,
            overrideAccess: true,
          });
          if (existingTx.totalDocs === 0) {
            await ctx.payload.create({
              collection: "transactions" as import("payload").CollectionSlug,
              data: {
                booking: bookingId,
                paymentMethod: "class_pass",
                classPassId: classPassIdUsed,
                ...(timeslotTenantId != null ? { tenant: timeslotTenantId } : {}),
              } as Record<string, unknown>,
              overrideAccess: true,
            });
          }
          await decrementClassPassCredits(1);
        }
      }

      return confirmedBookings;
    }),

  /**
   * Returns valid class passes for the current user for the given timeslot.
   * Only passes that belong to the timeslot's tenant and match the class option's allowed pass types,
   * with status active, quantity > 0, and expirationDate in the future.
   */
  getValidClassPassesForTimeslot: protectedProcedure
    .input(z.object({ timeslotId: z.number(), quantity: z.number().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      if (!hasCollection(ctx.payload, ctx.bookingsSlugs.timeslots) || !hasCollection(ctx.payload, "class-passes")) {
        return [];
      }

      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(ctx.payload, input.timeslotId, ctx.bookingsSlugs.timeslots);
      }
      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.timeslotId, {
        depth: 2,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });
      if (!timeslot) {
        return [];
      }
      await populateTimeslotEventType(ctx.payload, timeslot, ctx.bookingsSlugs.eventTypes);
      const eventType =
        typeof timeslot.eventType === "object" ? timeslot.eventType : null;
      const eventTypeWithPasses = eventType as (typeof eventType) & {
        paymentMethods?: { allowedClassPasses?: unknown[] };
      };
      const allowedClassPasses = eventTypeWithPasses?.paymentMethods?.allowedClassPasses;
      if (!allowedClassPasses || !Array.isArray(allowedClassPasses) || allowedClassPasses.length === 0) {
        return [];
      }
      const allowedTypeIds = (allowedClassPasses as (number | { id: number })[])
        .map((p) => (typeof p === "object" && p != null && "id" in p ? p.id : p))
        .filter((id): id is number => typeof id === "number");
      if (allowedTypeIds.length === 0) return [];

      const timeslotTenantId =
        typeof timeslot.tenant === "object" && timeslot.tenant != null
          ? (timeslot.tenant as { id: number }).id
          : (timeslot.tenant as number | undefined) ?? null;
      if (timeslotTenantId == null) return [];

      const now = new Date().toISOString();
      // Same `withTenantAccess` / empty session tenants issue as getPurchasableClassPassTypesForTimeslot.
      const result = await findSafe(
        ctx.payload,
        "class-passes",
        {
          where: {
            user: { equals: ctx.user.id },
            tenant: { equals: timeslotTenantId },
            type: { in: allowedTypeIds },
            status: { equals: "active" },
            quantity: { greater_than: 0 },
            expirationDate: { greater_than: now },
          },
          limit: 50,
          depth: 1,
          sort: "expirationDate",
          overrideAccess: true,
        }
      );
      return filterValidClassPassesForTimeslot(
        timeslot as unknown as TimeslotLike,
        result.docs as ClassPassLike[],
        new Date(),
        input.quantity ?? 1
      );
    }),

  getPurchasableClassPassTypesForTimeslot: protectedProcedure
    .input(z.object({ timeslotId: z.number(), quantity: z.number().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      if (!hasCollection(ctx.payload, ctx.bookingsSlugs.timeslots) || !hasCollection(ctx.payload, "class-pass-types")) {
        return [];
      }

      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(ctx.payload, input.timeslotId, ctx.bookingsSlugs.timeslots);
      }

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.timeslotId, {
        depth: 2,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });
      if (!timeslot) {
        return [];
      }

      await populateTimeslotEventType(ctx.payload, timeslot, ctx.bookingsSlugs.eventTypes);
      const eventType =
        typeof timeslot.eventType === "object" ? timeslot.eventType : null;
      const eventTypeWithPasses = eventType as (typeof eventType) & {
        paymentMethods?: { allowedClassPasses?: unknown[] };
      };
      const allowedClassPasses = eventTypeWithPasses?.paymentMethods?.allowedClassPasses;
      if (!Array.isArray(allowedClassPasses) || allowedClassPasses.length === 0) {
        return [];
      }

      const allowedTypeIds = (allowedClassPasses as (number | { id: number })[])
        .map((passType) =>
          typeof passType === "object" && passType != null && "id" in passType ? passType.id : passType
        )
        .filter((id): id is number => typeof id === "number");
      if (allowedTypeIds.length === 0) return [];

      const timeslotTenantId =
        typeof timeslot.tenant === "object" && timeslot.tenant != null
          ? (timeslot.tenant as { id: number }).id
          : (timeslot.tenant as number | undefined) ?? null;
      if (timeslotTenantId == null) {
        return [];
      }
      const tenantDoc = hasCollection(ctx.payload, "tenants")
        ? await ctx.payload
            .findByID({
              collection: "tenants" as any,
              id: timeslotTenantId,
              depth: 0,
              overrideAccess: true,
            })
            .catch(() => null)
        : null;
      const tenantStripeAccountId =
        tenantDoc &&
        typeof (tenantDoc as any)?.stripeConnectAccountId === "string" &&
        (tenantDoc as any).stripeConnectAccountId.trim() &&
        (tenantDoc as any)?.stripeConnectOnboardingStatus === "active"
          ? String((tenantDoc as any).stripeConnectAccountId).trim()
          : null;
      const stripeOpts = tenantStripeAccountId
        ? ({ stripeAccount: tenantStripeAccountId } satisfies Stripe.RequestOptions)
        : undefined;

      // `withTenantAccess` on class-pass-types adds tenant { in: sessionUser.tenants }.
      // Better Auth sessions often omit populated tenants, yielding `in: []` and a 403 from Payload.
      // Allowed IDs and tenant come from the timeslot's event type; scope is enforced in `where` below.
      const accessible = await findSafe(ctx.payload, "class-pass-types", {
        where: {
          id: { in: allowedTypeIds },
          status: { equals: "active" },
          tenant: { equals: timeslotTenantId },
        },
        limit: allowedTypeIds.length,
        depth: 0,
        overrideAccess: true,
      });

      const requiredQuantity = Math.max(1, input.quantity ?? 1);
      const docs = await Promise.all(
        accessible.docs.map(async (doc) => {
          const typeId = typeof doc?.id === "number" ? doc.id : null;
          if (typeId == null) return null;

          const fullDoc = await findByIdSafe(ctx.payload, "class-pass-types", typeId, {
            depth: 0,
            overrideAccess: true,
          });
          if (!fullDoc) return null;

          const passQuantity =
            typeof (fullDoc as { quantity?: unknown }).quantity === "number"
              ? ((fullDoc as { quantity: number }).quantity)
              : 0;
          const allowMultiple =
            (fullDoc as { allowMultipleBookingsPerTimeslot?: unknown }).allowMultipleBookingsPerTimeslot === true;

          if (passQuantity < requiredQuantity) return null;
          if (requiredQuantity > 1 && !allowMultiple) return null;

          // Extract priceId from priceJSON (may be a JSON string or a stored object)
          const rawPriceJsonField = (fullDoc as { priceJSON?: unknown }).priceJSON;
          let priceId: string | null = null;
          let priceSource: "priceJSON-string" | "priceJSON-object" | "stripeProduct-default_price" | "missing" =
            "missing";
          if (typeof rawPriceJsonField === "string" && rawPriceJsonField.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(rawPriceJsonField) as { id?: unknown };
              if (typeof parsed?.id === "string" && parsed.id.trim().length > 0) {
                priceId = parsed.id.trim();
                priceSource = "priceJSON-string";
              }
            } catch {
              priceId = null;
            }
          } else if (typeof rawPriceJsonField === "object" && rawPriceJsonField !== null) {
            const obj = rawPriceJsonField as { id?: unknown };
            if (typeof obj.id === "string" && obj.id.trim().length > 0) {
              priceId = obj.id.trim();
              priceSource = "priceJSON-object";
            }
          }
          // Fall back to stripeProductId: fetch the product's default price from Stripe
          if (priceId == null) {
            const stripeProductId =
              typeof (fullDoc as { stripeProductId?: unknown }).stripeProductId === "string"
                ? (fullDoc as { stripeProductId: string }).stripeProductId
                : null;
            if (stripeProductId && stripe) {
              try {
                const product = await stripe.products.retrieve(stripeProductId, {
                  expand: ["default_price"],
                }, stripeOpts);
                const defaultPrice = product.default_price as { id?: string } | null | undefined;
                if (typeof defaultPrice?.id === "string" && defaultPrice.id.trim().length > 0) {
                  priceId = defaultPrice.id.trim();
                  priceSource = "stripeProduct-default_price";
                }
              } catch {
                priceId = null;
              }
            }
          }
          ctx.payload.logger.info?.(
            {
              timeslotId: input.timeslotId,
              tenantId: timeslotTenantId,
              stripeAccount: tenantStripeAccountId,
              classPassTypeId: typeId,
              stripeProductId:
                typeof (fullDoc as { stripeProductId?: unknown }).stripeProductId === "string"
                  ? (fullDoc as { stripeProductId: string }).stripeProductId
                  : null,
              priceId,
              priceSource,
            },
            "[bookings] resolved purchasable class pass price",
          );

          return {
            id: typeId,
            name:
              typeof (fullDoc as { name?: unknown }).name === "string"
                ? (fullDoc as { name: string }).name
                : "Class pass",
            description:
              typeof (fullDoc as { description?: unknown }).description === "string"
                ? (fullDoc as { description: string }).description
                : null,
            quantity: passQuantity,
            allowMultipleBookingsPerTimeslot: allowMultiple,
            price:
              typeof (fullDoc as { priceInformation?: { price?: unknown } }).priceInformation?.price === "number"
                ? ((fullDoc as { priceInformation: { price: number } }).priceInformation.price)
                : null,
            priceId,
          };
        })
      );

      return docs.filter((doc): doc is NonNullable<typeof doc> => doc != null && doc.priceId != null);
    }),

  createOrUpdateBooking: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["confirmed", "cancelled"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<Booking> => {
      const { id, status = "confirmed" } = input;

      const tsForTenant = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, id, {
        depth: 0,
        overrideAccess: true,
      });
      const timeslotTenantId = tsForTenant ? deriveTenantIdFromTimeslot(tsForTenant) : null;

      const booking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: id },
          user: { equals: ctx.user.id },
          ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      });

      if (booking.docs.length === 0) {
        return await createSafe(ctx.payload, "bookings", {
          timeslot: Number(id),
          user: Number(ctx.user.id),
          status,
        }, {
          overrideAccess: true,
          user: ctx.user,
        });
      }

      const updatedBooking = await updateSafe(ctx.payload, "bookings", booking.docs[0]?.id as number, {
        status,
      }, {
        overrideAccess: true,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  cancelBooking: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }): Promise<Booking> => {
      const { id } = input;
      const tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));

      const booking = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          id: { equals: id },
          user: { equals: ctx.user.id },
          ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with id ${input.id} not found`,
        });
      }

      if (tenantId) {
        const docTenantId = getDocTenantId(booking.docs[0] as any);
        if (docTenantId != null && docTenantId !== tenantId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Booking with id ${input.id} not found`,
          });
        }
      }

      const previousStatus = booking.docs[0]?.status;
      const shouldSkipSideEffects =
        previousStatus === "pending" || previousStatus === "waiting";

      const updatedBooking = await updateSafe(ctx.payload, "bookings", id, {
        status: "cancelled",
      }, {
        overrideAccess: tenantId ? true : false,
        user: ctx.user,
        context: shouldSkipSideEffects ? { skipBookingSideEffects: true } : undefined,
      });

      return updatedBooking as Booking;
    }),

  /**
   * Cancel all of the current user's pending bookings for a timeslot.
   * Used when the user leaves the booking checkout page so capacity is released.
   */
  cancelPendingBookingsForTimeslot: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ timeslotId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<{ cancelled: number }> => {
      const pending = await findSafe(ctx.payload, "bookings", {
        where: {
          and: [
            { timeslot: { equals: input.timeslotId } },
            { user: { equals: ctx.user.id } },
            { status: { equals: "pending" } },
          ],
        },
        limit: 100,
        depth: 0,
        // This endpoint is explicitly used to release reserved capacity when a user
        // leaves checkout, so we must cancel *all* of the user's pending bookings for
        // this timeslot regardless of tenant-scoped access controls.
        overrideAccess: true,
        user: ctx.user,
      });

      let cancelled = 0;
      for (const doc of pending.docs) {
        const id = doc.id as number;
        if (id == null) continue;
        await updateSafe(ctx.payload, "bookings", id, { status: "cancelled" }, {
          overrideAccess: true,
          user: ctx.user,
          context: { skipBookingSideEffects: true },
        });
        cancelled += 1;
      }
      return { cancelled };
    }),

  /**
   * Cancel the newest `count` pending bookings for the current user + timeslot.
   * Used by the checkout "autosave quantity" control to avoid N sequential cancellations
   * from the client.
   */
  cancelNewestPendingBookingsForTimeslot: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ timeslotId: z.number(), count: z.number().min(1) }))
    .mutation(async ({ ctx, input }): Promise<{ cancelled: number; cancelledIds: number[] }> => {
      const pending = await findSafe(ctx.payload, "bookings", {
        where: {
          and: [
            { timeslot: { equals: input.timeslotId } },
            { user: { equals: ctx.user.id } },
            { status: { equals: "pending" } },
          ],
        },
        limit: Math.min(100, input.count),
        depth: 0,
        overrideAccess: true,
        sort: "-createdAt",
        // System operation: releasing reserved capacity when user changes checkout quantity.
        // We must cancel for this timeslot regardless of tenant-scoped access controls.
        user: ctx.user,
      });

      const cancelledIds: number[] = [];
      for (const doc of pending.docs) {
        const id = doc.id as number | undefined;
        if (id == null) continue;

        await updateSafe(
          ctx.payload,
          "bookings",
          id,
          { status: "cancelled" },
          {
            overrideAccess: true,
            user: ctx.user,
            context: { skipBookingSideEffects: true },
          }
        );

        cancelledIds.push(id);
      }

      return { cancelled: cancelledIds.length, cancelledIds };
    }),

  joinWaitlist: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ts = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.id, {
        depth: 0,
        overrideAccess: true,
      });
      const timeslotTenantId = ts ? deriveTenantIdFromTimeslot(ts) : null;

      const existingBooking = await findSafe(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.id },
          user: { equals: ctx.user.id },
          ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      });

      if (existingBooking.docs.length > 0) {
        const updatedBooking = await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
          status: "waiting",
        }, {
          overrideAccess: true,
          user: ctx.user,
        });

        return updatedBooking as Booking;
      }

      const booking = await createSafe(ctx.payload, "bookings", {
        timeslot: Number(input.id),
        user: Number(ctx.user.id),
        status: "waiting",
      }, {
        overrideAccess: true,
        user: ctx.user,
      });

      return booking as Booking;
    }),
  leaveWaitlist: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ts = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.id, {
        depth: 0,
        overrideAccess: true,
      });
      const timeslotTenantId = ts ? deriveTenantIdFromTimeslot(ts) : null;

      const booking = await findSafe(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.id },
          user: { equals: ctx.user.id },
          status: { equals: "waiting" },
          ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
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
        overrideAccess: true,
        user: ctx.user,
      });

      return updatedBooking as Booking;
    }),
  canBookChild: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const timeslot = await findByIdSafe<Timeslot>(
        ctx.payload,
        ctx.bookingsSlugs.timeslots,
        input.id,
        {
          depth: 3,
          overrideAccess: true,
        }
      );

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${input.id} not found`,
        });
      }

      if (timeslot.remainingCapacity && timeslot.remainingCapacity <= 0) {
        return false;
      }

      const eventType = timeslot.eventType as EventType;
      if (!eventType || eventType.type !== "child") {
        return false;
      }

      const plans = eventType.paymentMethods?.allowedPlans;
      const timeslotTenantId = deriveTenantIdFromTimeslot(timeslot);

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
            ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
            and: [
              {
                or: [
                  { cancelAt: { greater_than: new Date(timeslot.startTime) } },
                  { cancelAt: { exists: false } },
                ],
              },
            ],
          },
          depth: 2,
          limit: 1,
          overrideAccess: true,
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
          overrideAccess: true,
        });

        const childrenIds = childrenQuery.docs.map((child: any) => child.id);

        const bookedSessions = await findSafe(ctx.payload, "bookings", {
          where: {
            timeslot: {
              equals: timeslot.id,
            },
            user: { in: childrenIds },
            ...(timeslotTenantId != null ? { tenant: { equals: timeslotTenantId } } : {}),
          },
          depth: 2,
          overrideAccess: true,
        });

        const bookedSessionsCount = bookedSessions.docs.length;

        if (planQuantity && planQuantity <= bookedSessionsCount) {
          return false;
        }
      }

      return true;
    }),
  createChildBooking: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .use(requireCollections("users"))
    .input(
      z.object({
        timeslotId: z.number(),
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
          overrideAccess: true,
        }
      );

      if (!child) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Child with id ${input.childId} not found`,
        });
      }

      const childTs = await findByIdSafe<Timeslot>(
        ctx.payload,
        ctx.bookingsSlugs.timeslots,
        input.timeslotId,
        { depth: 0, overrideAccess: true }
      );
      const childTimeslotTenantId = childTs ? deriveTenantIdFromTimeslot(childTs) : null;

      const existingBooking = await findSafe(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.timeslotId },
          user: { equals: child.id },
          ...(childTimeslotTenantId != null ? { tenant: { equals: childTimeslotTenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      });

      if (existingBooking.docs.length > 0) {
        const updatedBooking = await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
          status: status,
        }, {
          overrideAccess: true,
          user: child,
        });

        return updatedBooking as Booking;
      }

      const booking = await createSafe(ctx.payload, "bookings", {
        timeslot: Number(input.timeslotId),
        user: Number(child.id),
        status: status,
      }, {
        overrideAccess: true,
        user: child,
      });
      return booking as Booking;
    }),
  cancelChildBooking: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .use(requireCollections("bookings"))
    .input(z.object({ timeslotId: z.number(), childId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const cancelTs = await findByIdSafe<Timeslot>(
        ctx.payload,
        ctx.bookingsSlugs.timeslots,
        input.timeslotId,
        { depth: 0, overrideAccess: true }
      );
      const cancelTimeslotTenantId = cancelTs ? deriveTenantIdFromTimeslot(cancelTs) : null;

      const booking = await findSafe(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.timeslotId },
          user: { equals: input.childId },
          ...(cancelTimeslotTenantId != null ? { tenant: { equals: cancelTimeslotTenantId } } : {}),
        },
        depth: 2,
        limit: 1,
        overrideAccess: true,
      });

      if (booking.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Booking with timeslot id ${input.timeslotId} and user id ${input.childId} not found`,
        });
      }

      const child = await findByIdSafe<any>(
        ctx.payload,
        "users",
        input.childId,
        {
          depth: 4,
          overrideAccess: true,
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
        overrideAccess: true,
        user: child,
      });

      return updatedBooking as Booking;
    }),
  getChildrensBookings: protectedProcedure
    .use(requireBookingCollections("timeslots"))
    .use(requireCollections("bookings"))
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const gcbTs = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, input.id, {
        depth: 0,
        overrideAccess: true,
      });
      const gcbTenantId = gcbTs ? deriveTenantIdFromTimeslot(gcbTs) : null;

      const bookings = await findSafe(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.id },
          "user.parentUser": { equals: ctx.user.id },
          status: { not_equals: "cancelled" },
          ...(gcbTenantId != null ? { tenant: { equals: gcbTenantId } } : {}),
        },
        depth: 2,
        overrideAccess: true,
      });

      return bookings.docs.map((booking: any) => booking as Booking);
    }),
  getUserBookingsForTimeslot: protectedProcedure
    .use(requireCollections("bookings"))
    .input(z.object({ timeslotId: z.number() }))
    .query(async ({ ctx, input }) => {
      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(ctx.payload, input.timeslotId, ctx.bookingsSlugs.timeslots);
      }

      const bookings = await findSafe(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: input.timeslotId },
          user: { equals: ctx.user.id },
          status: { not_equals: "cancelled" },
          ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
        },
        depth: 2,
        overrideAccess: true,
      });

      const filteredBookings = tenantId
        ? bookings.docs.filter((b: any) => {
            const docTid = getDocTenantId(b);
            return docTid === null || docTid === tenantId;
          })
        : bookings.docs;

      return filteredBookings.map((booking: any) => booking as Booking);
    }),
  /**
   * Unified schedule mutation: set the current viewer's booking intent for a timeslot.
   *
   * This is designed for the schedule button UX:
   * - one endpoint for book/cancel/waitlist actions
   * - returns a scheduleState snapshot so the UI can update predictably
   */
  setMyBookingForTimeslot: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .input(
      z.object({
        timeslotId: z.number(),
        intent: z.enum(["confirm", "cancel", "joinWaitlist", "leaveWaitlist"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { timeslotId, intent } = input;

      const viewerIdRaw: any = (ctx.user as any)?.id;
      const viewerId =
        typeof viewerIdRaw === "string" ? parseInt(viewerIdRaw, 10) : viewerIdRaw;
      if (!viewerId || Number.isNaN(viewerId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid user ID" });
      }

      let tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(ctx.payload, timeslotId, ctx.bookingsSlugs.timeslots);
      }

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, timeslotId, {
        depth: 0,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Timeslot with id ${timeslotId} not found` });
      }
      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, timeslotId);

      const timeslotTenantId = deriveTenantIdFromTimeslot(timeslot);

      const eventTypeId =
        typeof timeslot.eventType === "object" && timeslot.eventType !== null
          ? (timeslot.eventType as any).id
          : (timeslot.eventType as any);
      const eventType =
        typeof timeslot.eventType === "object" && timeslot.eventType !== null
          ? (timeslot.eventType as any)
          : eventTypeId != null && hasCollection(ctx.payload, ctx.bookingsSlugs.eventTypes)
            ? await findByIdSafe<EventType>(ctx.payload, ctx.bookingsSlugs.eventTypes, eventTypeId, {
                depth: 0,
                overrideAccess: Boolean(tenantId),
                user: ctx.user,
              })
            : null;

      const places =
        eventType && typeof (eventType as any).places === "number"
          ? (eventType as any).places
          : null;
      const isChildClass = eventType && (eventType as any).type === "child";

      const computeScheduleState = async (): Promise<
        TimeslotScheduleState & { creationClosed: boolean; isFull: boolean }
      > => {
        const now = new Date();
        const start = new Date(timeslot.startTime);
        const startMs = start.getTime();
        const end = new Date(timeslot.endTime);
        const endMs = end.getTime();
        const lockOutTime = typeof (timeslot as any).lockOutTime === "number" ? (timeslot as any).lockOutTime : 0;
        const hasPendingOrWaiting = (
          await ctx.payload.find({
            collection: ctx.bookingsSlugs.bookings as any,
            where: {
              and: [
                { timeslot: { equals: timeslotId } },
                { user: { equals: viewerId } },
                { status: { in: ["pending", "waiting"] } },
                ...(timeslotTenantId != null ? [{ tenant: { equals: timeslotTenantId } }] : []),
              ],
            },
            depth: 0,
            limit: 1,
            overrideAccess: true,
          })
        ).totalDocs > 0;

        // UI "closed" state: show closed once the session start time has passed.
        const startClosed =
          Number.isFinite(startMs) &&
          (now.getTime() >= startMs ||
            (lockOutTime > 0 && now.getTime() >= startMs - lockOutTime * 60_000));

        // Eligibility cutoff for bookings: allow booking until the session end time.
        // lockOutTime is interpreted as "minutes before the end" for booking eligibility.
        const creationClosed =
          Number.isFinite(endMs) &&
          !hasPendingOrWaiting &&
          (now.getTime() >= endMs ||
            (lockOutTime > 0 && now.getTime() >= endMs - lockOutTime * 60_000));

        const confirmedCountResult = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            and: [
              { timeslot: { equals: timeslotId } },
              { status: { equals: "confirmed" } },
              ...(timeslotTenantId != null ? [{ tenant: { equals: timeslotTenantId } }] : []),
            ],
          },
          depth: 0,
          limit: 0,
          overrideAccess: true,
        });
        const totalConfirmedCount = confirmedCountResult.totalDocs;
        const isFull = typeof places === "number" ? totalConfirmedCount >= places : false;

        const viewerBookingsResult = await findSafe<Booking>(ctx.payload, "bookings", {
          where: {
            and: [
              { timeslot: { equals: timeslotId } },
              { status: { in: ["confirmed", "waiting"] } },
              isChildClass ? { "user.parentUser": { equals: viewerId } } : { user: { equals: viewerId } },
              ...(timeslotTenantId != null ? [{ tenant: { equals: timeslotTenantId } }] : []),
            ],
          },
          depth: 0,
          limit: 0,
          overrideAccess: true,
        });

        const viewerConfirmedIds = (viewerBookingsResult.docs as any[])
          .filter((b) => b.status === "confirmed")
          .map((b) => Number(b.id))
          .filter((n) => Number.isFinite(n));
        const viewerWaitingIds = (viewerBookingsResult.docs as any[])
          .filter((b) => b.status === "waiting")
          .map((b) => Number(b.id))
          .filter((n) => Number.isFinite(n));

        const availability: TimeslotScheduleState["availability"] = startClosed ? "closed" : isFull ? "full" : "open";

        let action: TimeslotScheduleState["action"] = "book";
        if (availability === "closed") action = "closed";
        else if (isChildClass) action = "manageChildren";
        else if (viewerConfirmedIds.length >= 2) action = "modify";
        else if (viewerConfirmedIds.length === 1) action = "cancel";
        else if (viewerWaitingIds.length > 0) action = "leaveWaitlist";
        else if (availability === "full") action = "joinWaitlist";
        else action = "book";

        const labelByAction: Record<TimeslotScheduleState["action"], string> = {
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
          // Additional fields for intent gating (UI and eligibility can differ).
          creationClosed,
          isFull,
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

      // Child timeslots are handled on the dedicated children booking page.
      if (isChildClass) {
        return {
          scheduleState: await computeScheduleState(),
          redirectUrl: `/bookings/children/${timeslotId}`,
        };
      }

      const currentState = await computeScheduleState();

      // Execute intent
      if (intent === "confirm") {
        // Keep UI "closed" after start, but allow booking until end-time cutoff.
        if (currentState.creationClosed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Timeslot is closed" });
        }
        if (currentState.viewer.confirmedCount === 0) {
          await createSafe(ctx.payload, "bookings", {
            timeslot: Number(timeslotId),
            user: Number(viewerId),
            status: "confirmed",
          }, {
            overrideAccess: true,
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
            overrideAccess: true,
            user: ctx.user,
          });
        }
      } else if (intent === "joinWaitlist") {
        // Keep "closed" UI visible, but still allow join-waitlist while eligible.
        if (!currentState.isFull) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Timeslot is not full" });
        }
        if (currentState.creationClosed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Timeslot is closed" });
        }
        if (currentState.viewer.waitingCount === 0 && currentState.viewer.confirmedCount === 0) {
          await createSafe(ctx.payload, "bookings", {
            timeslot: Number(timeslotId),
            user: Number(viewerId),
            status: "waiting",
          }, {
            overrideAccess: true,
            user: ctx.user,
          });
        }
      } else if (intent === "leaveWaitlist") {
        for (const bookingId of currentState.viewer.waitingIds) {
          await updateSafe(ctx.payload, "bookings", bookingId, { status: "cancelled" }, {
            overrideAccess: true,
            user: ctx.user,
          });
        }
      }

      return {
        scheduleState: await computeScheduleState(),
      };
    }),
  /**
   * Validates if a user can be checked in for a timeslot and attempts check-in if possible.
   * This is designed to be called at the page level before rendering booking components.
   * 
   * @returns Object indicating whether check-in succeeded and redirect should occur
   */
  validateAndAttemptCheckIn: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .input(z.object({ timeslotId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { timeslotId } = input;
      const tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, timeslotId, {
        depth: 0,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${timeslotId} not found`,
        });
      }
      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, timeslotId);

      const checkInTimeslotTenantId = deriveTenantIdFromTimeslot(timeslot);

      // Check if timeslot status allows immediate check-in
      if (!['active', 'trialable'].includes(timeslot.bookingStatus || '')) {
        return {
          shouldRedirect: false,
          error: null,
          reason: `Timeslot status is ${timeslot.bookingStatus}, check-in not available`,
        };
      }

      console.log("User is authenticated:", ctx.user);

      // Attempt check-in by calling the existing checkIn procedure logic
      try {
        // Business Logic: Handle children's timeslots differently
        const eventTypeId =
          typeof timeslot.eventType === "object" && timeslot.eventType !== null
            ? (timeslot.eventType as any).id
            : (timeslot.eventType as any);
        const eventType =
          typeof timeslot.eventType === "object" && timeslot.eventType !== null
            ? (timeslot.eventType as any)
            : eventTypeId != null && hasCollection(ctx.payload, ctx.bookingsSlugs.eventTypes)
              ? await findByIdSafe<EventType>(ctx.payload, ctx.bookingsSlugs.eventTypes, eventTypeId, {
                  depth: 0,
                  overrideAccess: Boolean(tenantId),
                  user: ctx.user,
                })
              : null;

        if ((eventType as any)?.type === "child") {
          return {
            shouldRedirect: false,
            error: "REDIRECT_TO_CHILDREN_BOOKING",
            reason: "This is a children's timeslot",
            redirectUrl: `/bookings/children/${timeslotId}`,
          };
        }

        // Try to create/update booking
        const existingBooking = await findSafe(ctx.payload, "bookings", {
          where: {
            timeslot: { equals: timeslotId },
            user: { equals: ctx.user.id },
            ...(checkInTimeslotTenantId != null ? { tenant: { equals: checkInTimeslotTenantId } } : {}),
          },
          depth: 2,
          limit: 1,
          overrideAccess: true,
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
            timeslot: Number(timeslotId),
            user: Number(userId),
            status: "confirmed",
          }, {
            overrideAccess: true,
            user: ctx.user,
          });
        } else {
          // Update existing booking
          await updateSafe(ctx.payload, "bookings", existingBooking.docs[0]?.id as number, {
            status: "confirmed",
          }, {
            overrideAccess: true,
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
          redirectUrl: `/bookings/${timeslotId}`,
        };
      }
    }),
  setMyBookingQuantityForTimeslot: protectedProcedure
    .use(requireBookingCollections("timeslots", "bookings"))
    .input(
      z.object({
        timeslotId: z.number(),
        desiredQuantity: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }): Promise<Booking[]> => {
      const { timeslotId, desiredQuantity } = input;
      const tenantId = await resolveTenantId(ctx.payload, getTenantSlug(ctx));

      const timeslot = await findByIdSafe<Timeslot>(ctx.payload, ctx.bookingsSlugs.timeslots, timeslotId, {
        depth: 0,
        overrideAccess: Boolean(tenantId),
        user: ctx.user,
      });

      if (!timeslot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Timeslot with id ${timeslotId} not found`,
        });
      }
      if (tenantId) assertTimeslotBelongsToTenant(timeslot, tenantId, timeslotId);

      const qtyTimeslotTenantId = deriveTenantIdFromTimeslot(timeslot);

      // Ensure eventType has paymentMethods if we need subscription-based quantity rules.
      if (hasCollection(ctx.payload, ctx.bookingsSlugs.eventTypes)) {
        const co = timeslot.eventType as any;
        const coId = typeof co === "object" && co != null ? co.id : co;
        const needsFetch =
          typeof co !== "object" ||
          co == null ||
          (typeof co === "object" && co != null && (co as any).paymentMethods === undefined);
        if (coId != null && needsFetch) {
          const populated = await findByIdSafe<EventType>(ctx.payload, ctx.bookingsSlugs.eventTypes, coId, {
            depth: 2,
            overrideAccess: Boolean(tenantId),
            user: ctx.user,
          });
          if (populated) {
            (timeslot as any).eventType = populated as any;
          }
        }
      }

      const currentBookings = await findSafe<Booking>(ctx.payload, "bookings", {
        where: {
          timeslot: { equals: timeslotId },
          user: { equals: ctx.user.id },
          status: { not_equals: "cancelled" },
          ...(qtyTimeslotTenantId != null ? { tenant: { equals: qtyTimeslotTenantId } } : {}),
        },
        depth: 1,
        overrideAccess: true,
      });

      const filteredBookings = tenantId
        ? currentBookings.docs.filter((b: any) => {
            const docTid = getDocTenantId(b);
            return docTid === null || docTid === tenantId;
          })
        : currentBookings.docs;

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
        const maxAdditional = timeslot.remainingCapacity || 0;
        if (additional > maxAdditional) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot book more than ${maxAdditional} additional slot${maxAdditional !== 1 ? 's' : ''}. Only ${maxAdditional} available.`,
          });
        }

        // Enforce subscription allowMultipleBookingsPerTimeslot when adding confirmed bookings
        const maxSubQty = await getMaxSubscriptionQuantityPerTimeslot(
          Number(ctx.user.id),
          timeslot,
          ctx.payload
        );
        if (maxSubQty != null) {
          const maxAdditionalFromSub = Math.max(0, maxSubQty - currentConfirmed);
          if (additional > maxAdditionalFromSub) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                maxAdditionalFromSub === 0
                  ? "You already have the maximum bookings for this timeslot. Your membership allows one slot per timeslot."
                  : `Your membership allows at most ${maxSubQty} slot${maxSubQty !== 1 ? "s" : ""} per timeslot. You can add ${maxAdditionalFromSub} more.`,
            });
          }
        }

        // Create additional bookings
        const newBookings: Booking[] = [];
        const lastCreationIndex = additional - 1;
        for (let i = 0; i < additional; i++) {
          const booking = await createSafe<Booking>(
            ctx.payload,
            "bookings",
            {
              timeslot: Number(timeslotId),
              user: Number(ctx.user.id),
              status: "confirmed",
            },
            {
              // Same as createBookings: access and capacity already validated in this mutation.
              overrideAccess: true,
              context: { skipBookingSideEffects: i < lastCreationIndex },
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
              ...(qtyTimeslotTenantId != null ? { tenant: { equals: qtyTimeslotTenantId } } : {}),
            },
            depth: 1,
            overrideAccess: true,
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
        const lastCancellationIndex = Math.min(toCancel, sortedBookings.length) - 1;
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
              overrideAccess: true,
              user: ctx.user,
              // Avoid sending waitlist emails for intermediate cancellations inside a bulk
              // quantity update, which otherwise runs the hook multiple times and can block.
              context: {
                skipWaitlistEmails: i < lastCancellationIndex,
                skipBookingSideEffects: i < lastCancellationIndex,
              },
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

import { z } from "zod";
import {
  optionalUserProcedure,
  protectedProcedure,
  requireBookingCollections,
  requireCollections,
} from "../trpc";
import { findByIdSafe, findSafe } from "../utils/collections";
import {
  getTenantSlug,
  resolveTenantId,
  resolveTenantIdFromTimeslotId,
} from "../utils/tenant";

import { Subscription, Timeslot, Plan } from "@repo/shared-types";
import { getIntervalStartAndEndDate } from "@repo/shared-utils";
import {
  hasReachedSubscriptionLimit,
  getRemainingSessionsInPeriod,
  subscriptionNeedsCustomerPortal,
  getSubscriptionUpgradeOptions,
  getRemainingSessionsInPeriodForPlan,
} from "@repo/shared-services";

export const subscriptionsRouter = {
  getSubscription: protectedProcedure
    .use(requireCollections("subscriptions"))
    .query(async ({ ctx }) => {
      const { user, payload } = ctx;

      const tenantId = await resolveTenantId(payload, getTenantSlug(ctx));

      const userSubscription = await findSafe<Subscription>(
        payload,
        "subscriptions",
        {
          where: {
            user: { equals: user.id },
            status: { equals: "active" },
            startDate: { less_than_equal: new Date() },
            endDate: { greater_than_equal: new Date() },
            ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
          },
          limit: 1,
          depth: 2,
          overrideAccess: true,
        }
      );

      return userSubscription.docs[0] || null;
    }),
  hasValidSubscription: protectedProcedure
    .use(requireCollections("subscriptions"))
    .input(
      z.object({
        plans: z.array(z.number()),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, payload } = ctx;

      if (!input.plans || input.plans.length === 0) {
        return null;
      }

      try {
        const tenantId = await resolveTenantId(payload, getTenantSlug(ctx));

        const userSubscription = await findSafe<Subscription>(
          payload,
          "subscriptions",
          {
            where: {
              user: { equals: user.id },
              status: {
                not_in: [
                  "canceled",
                  "unpaid",
                  "incomplete_expired",
                  "incomplete",
                ],
              },
              startDate: { less_than: new Date() },
              endDate: { greater_than: new Date() },
              plan: { in: input.plans },
              ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
            },
            limit: 1,
            depth: 2,
            overrideAccess: true,
          }
        );

        return userSubscription.docs[0] ?? null;
      } catch (error) {
        payload.logger.error(`Error finding subscription: ${error}`);
        return null;
      }
    }),
  limitReached: protectedProcedure
    .use(requireCollections("bookings"))
    .input(
      z.object({
        subscription: z.object({
          plan: z.object({
            id: z.number(),
            sessionsInformation: z
              .object({
                sessions: z.number().nullable().optional(),
                interval: z
                  .enum(["day", "week", "month", "quarter", "year"])
                  .nullable()
                  .optional(),
                intervalCount: z.number().nullable().optional(),
              })
              .nullable()
              .optional(),
          }),
        }),
        timeslotDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, payload } = ctx;
      const { subscription, timeslotDate } = input;

      const plan = subscription.plan;

      if (
        !plan.sessionsInformation ||
        plan.sessionsInformation.sessions == null ||
        !plan.sessionsInformation.interval ||
        plan.sessionsInformation.intervalCount == null
      ) {
        payload.logger.info(
          `Plan does not have sessions information (planId: ${plan.id})`
        );
        return false;
      }

      const { startDate, endDate } = getIntervalStartAndEndDate(
        plan.sessionsInformation.interval,
        plan.sessionsInformation.intervalCount || 1,
        timeslotDate
      );

      // TODO: add a check to see if the subscription is a drop in or free
      // if it is, then we need to check the drop in limit
      // if it is not, then we need to check the sessions limit

      try {
        const tenantId = await resolveTenantId(payload, getTenantSlug(ctx));

        const bookings = await findSafe(payload, "bookings", {
          depth: 5,
          where: {
            user: { equals: user.id },
            "timeslot.eventType.paymentMethods.allowedPlans": {
              contains: plan.id,
            },
            "timeslot.startTime": {
              greater_than: startDate,
              less_than: endDate,
            },
            status: { equals: "confirmed" },
            ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
          },
          overrideAccess: true,
        });

        payload.logger.info(
          `Bookings found for subscription (planId: ${plan.id}, count: ${bookings.docs.length})`
        );

        if (bookings.docs.length >= plan.sessionsInformation.sessions) {
          return true;
        }
      } catch (error) {
        console.error("Error finding bookings:", error);
        throw error;
      }

      return false;
    }),
  getSubscriptionForTimeslot: optionalUserProcedure
    .use(requireBookingCollections("timeslots"))
    .use(requireCollections("subscriptions"))
    .input(
      z.object({
        timeslotId: z.number(),
        /** Selected booking quantity on the booking page (used to filter eligible upgrade plans). */
        quantity: z.number().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, payload } = ctx;

      // Logged out (or session missing): safe fallback so payment UI can still render.
      if (!user) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
          remainingSessions: null,
          needsCustomerPortal: false,
          upgradeOptions: [],
          eligiblePlansForQuantity: null,
        };
      }

      let tenantId = await resolveTenantId(payload, getTenantSlug(ctx));
      if (tenantId == null) {
        tenantId = await resolveTenantIdFromTimeslotId(payload, input.timeslotId, ctx.bookingsSlugs.timeslots);
      }

      // Get the timeslot to check allowed plans
      const timeslot = await findByIdSafe<Timeslot>(
        payload,
        ctx.bookingsSlugs.timeslots,
        input.timeslotId,
        { depth: 2, overrideAccess: Boolean(tenantId), user }
      );

      if (!timeslot) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
          remainingSessions: null,
          needsCustomerPortal: false,
          upgradeOptions: [],
          eligiblePlansForQuantity: null,
        };
      }

      const eventType =
        typeof timeslot.eventType === "object" ? timeslot.eventType : null;
      const allowedPlans = eventType?.paymentMethods?.allowedPlans || [];
      const allowedPlanDocs = (allowedPlans as unknown[]).filter(
        (p): p is Plan => typeof p === "object" && p != null && "id" in p
      );

      if (allowedPlans.length === 0) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
          remainingSessions: null,
          needsCustomerPortal: false,
          upgradeOptions: [],
          eligiblePlansForQuantity: null,
        };
      }

      // Find subscription for this user with allowed plans (include past_due so UI can show portal)
      const userSubscription = await findSafe<Subscription & { plan: Plan }>(
        payload,
        "subscriptions",
        {
          where: {
            user: { equals: user.id },
            status: {
              not_in: [
                "canceled",
                "incomplete_expired",
                "incomplete",
              ],
            },
            startDate: { less_than_equal: new Date() },
            endDate: { greater_than_equal: new Date() },
            plan: {
              in: allowedPlans.map((plan: any) => plan.id || plan),
            },
            ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
          },
          limit: 1,
          depth: 2,
          overrideAccess: true,
        }
      );

      const subscription = userSubscription.docs[0];

      if (!subscription) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
          remainingSessions: null,
          needsCustomerPortal: false,
          upgradeOptions: [],
          eligiblePlansForQuantity: null,
        };
      }

      const needsCustomerPortal = subscriptionNeedsCustomerPortal(
        subscription.status
      );

      // Check if subscription limit is reached
      const limitReached = await hasReachedSubscriptionLimit(
        subscription as Subscription,
        payload,
        new Date(timeslot.startTime)
      );

      const remainingSessions = await getRemainingSessionsInPeriod(
        subscription as Subscription,
        payload,
        new Date(timeslot.startTime)
      );

      const selectedQuantity = input.quantity ?? 1;
      const timeslotDate = new Date(timeslot.startTime);

      const eligiblePlansForQuantity =
        selectedQuantity > 1
          ? await (async () => {
              const candidates = allowedPlanDocs.filter((p) => p.status === "active");
              const eligible: Plan[] = [];
              for (const plan of candidates) {
                const allowsMultiple =
                  plan.sessionsInformation?.allowMultipleBookingsPerTimeslot ===
                  true;
                if (!allowsMultiple) continue;

                const remainingForPlan = await getRemainingSessionsInPeriodForPlan(
                  subscription as Subscription,
                  plan,
                  payload,
                  timeslotDate
                );

                if (remainingForPlan != null && remainingForPlan < selectedQuantity) {
                  continue;
                }

                eligible.push(plan);
              }
              return eligible;
            })()
          : null;

      const upgradeOptions =
        limitReached && allowedPlans.length > 0
          ? await getSubscriptionUpgradeOptions(
              subscription as Subscription,
              (eligiblePlansForQuantity ?? allowedPlanDocs) as Plan[],
              payload,
              new Date(timeslot.startTime)
            )
          : [];

      return {
        subscription,
        subscriptionLimitReached: limitReached,
        remainingSessions,
        needsCustomerPortal,
        upgradeOptions,
        eligiblePlansForQuantity,
      };
    }),
};

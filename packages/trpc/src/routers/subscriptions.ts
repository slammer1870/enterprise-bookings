import { z } from "zod";
import { protectedProcedure, requireCollections } from "../trpc";
import { findByIdSafe, findSafe } from "../utils/collections";

import { Subscription, Lesson, Plan } from "@repo/shared-types";
import { getIntervalStartAndEndDate } from "@repo/shared-utils";
import { hasReachedSubscriptionLimit } from "@repo/shared-services";

export const subscriptionsRouter = {
  getSubscription: protectedProcedure
    .use(requireCollections("subscriptions"))
    .query(async ({ ctx }) => {
      const { user, payload } = ctx;

      const userSubscription = await findSafe<Subscription>(
        payload,
        "subscriptions",
        {
          where: {
            user: { equals: user.id },
            status: { equals: "active" },
            startDate: { less_than_equal: new Date() },
            endDate: { greater_than_equal: new Date() },
          },
          limit: 1,
          depth: 2,
          overrideAccess: false,
          user: user,
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
            },
            limit: 1,
            depth: 2,
            overrideAccess: false,
            user: user,
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
        lessonDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, payload } = ctx;
      const { subscription, lessonDate } = input;

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
        lessonDate
      );

      // TODO: add a check to see if the subscription is a drop in or free
      // if it is, then we need to check the drop in limit
      // if it is not, then we need to check the sessions limit

      try {
        const bookings = await findSafe(payload, "bookings", {
          depth: 5,
          where: {
            user: { equals: user.id },
            "lesson.classOption.paymentMethods.allowedPlans": {
              contains: plan.id,
            },
            "lesson.startTime": {
              greater_than: startDate,
              less_than: endDate,
            },
            status: { equals: "confirmed" },
          },
          overrideAccess: false,
          user: user,
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
  getSubscriptionForLesson: protectedProcedure
    .use(requireCollections("lessons", "subscriptions"))
    .input(
      z.object({
        lessonId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, payload } = ctx;

      // Get the lesson to check allowed plans
      const lesson = await findByIdSafe<Lesson>(
        payload,
        "lessons",
        input.lessonId,
        { depth: 2, overrideAccess: false, user }
      );

      if (!lesson) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
        };
      }

      const classOption =
        typeof lesson.classOption === "object" ? lesson.classOption : null;
      const allowedPlans = classOption?.paymentMethods?.allowedPlans || [];

      if (allowedPlans.length === 0) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
        };
      }

      // Find active subscription for this user with allowed plans
      const userSubscription = await findSafe<Subscription & { plan: Plan }>(
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
            startDate: { less_than_equal: new Date() },
            endDate: { greater_than_equal: new Date() },
            plan: {
              in: allowedPlans.map((plan: any) => plan.id || plan),
            },
          },
          limit: 1,
          depth: 2,
          overrideAccess: false,
          user,
        }
      );

      const subscription = userSubscription.docs[0];

      if (!subscription) {
        return {
          subscription: null,
          subscriptionLimitReached: false,
        };
      }

      // Check if subscription limit is reached
      const limitReached = await hasReachedSubscriptionLimit(
        subscription as Subscription,
        payload,
        new Date(lesson.startTime)
      );

      return {
        subscription,
        subscriptionLimitReached: limitReached,
      };
    }),
};

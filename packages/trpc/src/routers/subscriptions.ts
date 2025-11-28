import { z } from "zod";
import { protectedProcedure, requireCollections } from "../trpc";
import { findSafe, findByIdSafe } from "../utils/collections";

import { Subscription, Plan, Lesson } from "@repo/shared-types";
import { getIntervalStartAndEndDate } from "@repo/shared-utils";
import { hasReachedSubscriptionLimit } from "@repo/shared-services";

export const subscriptionsRouter = {
  getSubscription: protectedProcedure
    .use(requireCollections("subscriptions"))
    .query(async ({ ctx }): Promise<Subscription | null> => {
      const { user, payload } = ctx;

      const userSubscription = await findSafe<Subscription>(payload, "subscriptions", {
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
      });

      return userSubscription.docs[0] || null;
    }),
  hasValidSubscription: protectedProcedure
    .use(requireCollections("subscriptions"))
    .input(
      z.object({
        plans: z.array(z.number()),
      })
    )
    .query(async ({ ctx, input }): Promise<Subscription | null> => {
      const { user, payload } = ctx;

      if (!input.plans || input.plans.length === 0) {
        return null;
      }

      try {
        const userSubscription = await findSafe<Subscription>(payload, "subscriptions", {
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
        });

        return userSubscription.docs[0] ?? null;
      } catch (error) {
        payload.logger.error({
          message: "Error finding subscription:",
          error,
        });
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
        payload.logger.info({
          message: "Plan does not have sessions information",
          planId: plan.id,
          sessionsInformation: plan.sessionsInformation,
        });
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

        payload.logger.info({
          message: "Bookings found for subscription",
          bookings,
          subscription,
          plan,
          startDate,
          endDate,
        });

        if (bookings.docs.length >= plan.sessionsInformation.sessions) {
          return true;
        }
      } catch (error) {
        console.error("Error finding bookings:", error);
        throw error;
      }

      return false;
    }),
  /**
   * Gets subscription for a lesson and checks if limit is reached
   * This is a convenience procedure that combines getSubscription and limitReached
   */
  getSubscriptionForLesson: protectedProcedure
    .use(requireCollections("subscriptions", "lessons", "bookings"))
    .input(
      z.object({
        lessonId: z.number(),
      })
    )
    .query(async ({ ctx, input }): Promise<{ subscription: Subscription | null; subscriptionLimitReached: boolean }> => {
      const { user, payload } = ctx;

      // Get the lesson to extract lesson date and allowed plans
      const lesson = await findByIdSafe<Lesson>(payload, "lessons", input.lessonId, {
        depth: 3,
        overrideAccess: false,
        user: user,
      });

      if (!lesson) {
        throw new Error(`Lesson with id ${input.lessonId} not found`);
      }

      // Get allowed plan IDs from the lesson
      const allowedPlanIds = lesson.classOption.paymentMethods?.allowedPlans?.map(
        (plan) => typeof plan === 'object' ? plan.id : plan
      ) || [];

      // Get user's subscription that matches allowed plans
      const subscription = await findSafe<Subscription>(payload, "subscriptions", {
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
          plan: { in: allowedPlanIds },
        },
        limit: 1,
        depth: 3,
        overrideAccess: false,
        user: user,
      });

      const userSubscription = subscription.docs[0] ?? null;

      // Check if limit is reached if subscription exists
      const subscriptionLimitReached = userSubscription
        ? await hasReachedSubscriptionLimit(
            userSubscription,
            payload,
            new Date(lesson.startTime)
          )
        : false;

      return {
        subscription: userSubscription,
        subscriptionLimitReached,
      };
    }),
};

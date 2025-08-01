import { z } from "zod";
import { protectedProcedure } from "../trpc";

import { Subscription } from "@repo/shared-types";
import { getIntervalStartAndEndDate } from "@repo/shared-utils";

export const subscriptionsRouter = {
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const { user, payload } = ctx;

    const userSubscription = await payload.find({
      collection: "subscriptions",
      where: {
        user: { equals: user.id },
        status: { equals: "active" },
        startDate: { less_than: new Date() },
        endDate: { greater_than: new Date() },
      },
      limit: 1,
      depth: 2,
    });

    return userSubscription.docs[0] as Subscription | undefined;
  }),
  hasValidSubscription: protectedProcedure
    .input(
      z.object({
        plans: z.array(z.number()),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, payload } = ctx;

      if (!input.plans) {
        return undefined;
      }

      const userSubscription = await payload.find({
        collection: "subscriptions",
        where: {
          user: { equals: user.id },
          status: { not_equals: "canceled" },
          startDate: { less_than: new Date() },
          endDate: { greater_than: new Date() },
          plan: { in: input.plans },
        },
        limit: 1,
        depth: 2,
      });

      return userSubscription.docs[0] as Subscription | undefined;
    }),
  limitReached: protectedProcedure
    .input(
      z.object({
        subscription: z.object({
          plan: z.object({
            id: z.number(),
            sessionsInformation: z
              .object({
                sessions: z.number().optional(),
                interval: z
                  .enum(["day", "week", "month", "quarter", "year"])
                  .optional(),
                intervalCount: z.number().optional(),
              })
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
        !plan.sessionsInformation.sessions ||
        !plan.sessionsInformation.interval ||
        !plan.sessionsInformation.intervalCount
      ) {
        payload.logger.info("Plan does not have sessions information");
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
        const bookings = await payload.find({
          collection: "bookings",
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
        });

        payload.logger.info("Bookings found for subscription", {
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
};

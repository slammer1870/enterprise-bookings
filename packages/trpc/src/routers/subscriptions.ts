import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { Subscription } from "@repo/shared-types";

export const subscriptionsRouter = {
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
};

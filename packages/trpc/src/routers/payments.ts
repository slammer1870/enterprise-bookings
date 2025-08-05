import { z } from "zod";

import { stripeProtectedProcedure } from "../trpc";

export const paymentsRouter = {
  createSubscriptionCheckoutSession: stripeProtectedProcedure
    .input(
      z.object({
        priceId: z.string(),
        metadata: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: input.priceId,
            quantity: 1,
          },
        ],
        metadata: input.metadata,
        mode: "subscription",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      });

      return session;
    }),
};

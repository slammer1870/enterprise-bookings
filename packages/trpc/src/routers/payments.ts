import { z } from "zod";

import { stripeProtectedProcedure } from "../trpc";

export const paymentsRouter = {
  createCustomerCheckoutSession: stripeProtectedProcedure
    .input(
      z.object({
        priceId: z.string(),
        quantity: z.number().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
        mode: z.enum(["subscription", "payment"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.stripe.checkout.sessions.create({
        line_items: [
          {
            price: input.priceId,
            quantity: input.quantity || 1,
          },
        ],
        metadata: input.metadata,
        mode: input.mode,
        success_url:
          input.successUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
        cancel_url:
          input.cancelUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      });

      return session;
    }),
  createCustomerPortal: stripeProtectedProcedure.mutation(async ({ ctx }) => {
    const session = await ctx.stripe.billingPortal.sessions.create({
      customer: ctx.user.stripeCustomerId as string,
      return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
    });

    return session;
  }),
  createCustomerUpgradePortal: stripeProtectedProcedure
    .input(
      z.object({
        productId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.payload.find({
        collection: "plans",
        where: {
          stripeProductId: { equals: input.productId },
        },
      });

      if (product.docs.length === 0) {
        throw new Error("Product not found");
      }

      const priceId = JSON.parse(product?.docs[0]?.priceJSON as string)?.id;

      const subscription = await ctx.stripe.subscriptions.list({
        customer: ctx.user.stripeCustomerId as string,
        limit: 1,
        status: "active",
      });

      if (subscription.data.length === 0) {
        throw new Error("No active subscription found");
      }

      let configId: string | undefined;

      // Create a new configuration if none exist
      const newConfig = await ctx.stripe.billingPortal.configurations.create({
        business_profile: {
          headline: "Manage your subscription",
        },
        features: {
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            proration_behavior: "create_prorations",
            products: [
              {
                product: input.productId,
                prices: [priceId],
              },
            ],
          },
          customer_update: {
            enabled: true,
            allowed_updates: ["email", "address"],
          },
          invoice_history: { enabled: true },
        },
      });

      configId = newConfig.id;
      console.log(`Created new configuration: ${configId}`);

      const session = await ctx.stripe.billingPortal.sessions.create({
        customer: ctx.user.stripeCustomerId as string,
        configuration: configId,
        return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
        flow_data: {
          type: "subscription_update",
          subscription_update: {
            subscription: subscription.data[0]?.id as string,
          },
        },
      });

      return session;
    }),
};

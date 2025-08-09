import { z } from "zod";

import { stripeProtectedProcedure } from "../trpc";
import { stripe } from "@repo/shared-utils";

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
        priceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const configurations =
        await ctx.stripe.billingPortal.configurations.list();

      let configId: string | undefined;

      if (configurations.data.length > 0) {
        // Use the first configuration (typically the default one)
        configId = configurations.data[0]?.id || "";
        console.log(`Using existing configuration: ${configId}`);
      } else {
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
      }

      const config = await ctx.stripe.billingPortal.configurations.update(
        configId,
        {
          features: {
            subscription_update: {
              enabled: true,
              default_allowed_updates: ["price"],
              proration_behavior: "create_prorations",
              products: [
                {
                  product: input.productId,
                  prices: [input.priceId],
                },
              ],
            },
          },
        }
      );

      const session = await ctx.stripe.billingPortal.sessions.create({
        customer: ctx.user.stripeCustomerId as string,
        configuration: configId,
        return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      });

      return session;
    }),
};

import { z } from "zod";

import { stripeProtectedProcedure, requireCollections } from "../trpc";
import { findSafe } from "../utils/collections";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

// Helper function to safely get stripeCustomerId
const getStripeCustomerId = (user: object): string => {
  const customerId = (user as { stripeCustomerId?: string })?.stripeCustomerId;
  if (!customerId || typeof customerId !== "string") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Stripe customer ID not found. Please ensure the payments plugin is configured.",
    });
  }
  return customerId;
};

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
      // E2E/CI: don't call Stripe. We only need a redirect URL to keep the booking flow deterministic.
      // Playwright config sets ENABLE_TEST_WEBHOOKS=true; using it here avoids external dependency flakes.
      if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
        // Keep return type consistent with the real Stripe call so builds don't break.
        // NOTE: Stripe.Response<T> is effectively T augmented with `lastResponse`, so callers expect `session.url`.
        const redirectUrl = (() => {
          const raw =
            input.successUrl ||
            `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`;
          try {
            // Next/router.push expects an internal path; normalize absolute URLs to a pathname.
            return raw.startsWith("http") ? new URL(raw).pathname : raw;
          } catch {
            return "/dashboard";
          }
        })();

        return ({
          object: "checkout.session",
          id: `cs_test_${Date.now()}`,
          url: redirectUrl,
          lastResponse: {} as Stripe.Response<Stripe.Checkout.Session>["lastResponse"],
        } as unknown) as Stripe.Response<Stripe.Checkout.Session>;
      }

      const customerId = getStripeCustomerId(ctx.user);

      const session = await ctx.stripe.checkout.sessions.create({
        line_items: [
          {
            price: input.priceId,
            quantity: input.quantity || 1,
          },
        ],
        metadata: input.metadata,
        mode: input.mode,
        customer: customerId,
        success_url:
          input.successUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
        cancel_url:
          input.cancelUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      });

      return session;
    }),
  createCustomerPortal: stripeProtectedProcedure.mutation(async ({ ctx }) => {
    const customerId = getStripeCustomerId(ctx.user);

    const session = await ctx.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
    });

    return session;
  }),
  createCustomerUpgradePortal: stripeProtectedProcedure
    .use(requireCollections("plans"))
    .input(
      z.object({
        productId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await findSafe(ctx.payload, "plans", {
        where: {
          stripeProductId: { equals: input.productId },
        },
        overrideAccess: false,
        user: ctx.user,
      });

      if (product.docs.length === 0) {
        throw new Error("Product not found");
      }

      const priceId = JSON.parse(product?.docs[0]?.priceJSON as string)?.id;

      const customerId = getStripeCustomerId(ctx.user);

      const subscription = await ctx.stripe.subscriptions.list({
        customer: customerId,
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
        customer: customerId,
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
  /**
   * Creates a payment intent for one-time payments (e.g., drop-ins)
   */
  createPaymentIntent: stripeProtectedProcedure
    .use(requireCollections("users"))
    .input(
      z.object({
        amount: z.number(),
        metadata: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, stripe } = ctx;
      const { amount, metadata } = input;

      // Get user details to access email and customer ID
      const userDoc = await findSafe(ctx.payload, "users", {
        where: {
          id: { equals: user.id },
        },
        limit: 1,
        overrideAccess: false,
        user: user,
      });

      if (userDoc.docs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const userData = userDoc.docs[0] as any;

      // Format amount for Stripe (convert to cents)
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        automatic_payment_methods: { enabled: true },
        currency: "eur",
        receipt_email: userData.email,
        customer: userData.stripeCustomerId || undefined,
        metadata: metadata,
      });

      return {
        clientSecret: paymentIntent.client_secret as string,
        amount: amount,
      };
    }),
};

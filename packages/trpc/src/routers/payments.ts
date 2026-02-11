import { z } from "zod";

import {
  stripeProtectedProcedure,
  protectedProcedure,
  requireCollections,
  type GetSubscriptionBookingFeeCents,
} from "../trpc";
import { findSafe } from "../utils/collections";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

export type GetDropInFeeBreakdown = (_params: {
  payload: any;
  lessonId: number;
  classPriceCents: number;
}) => Promise<{ classPriceCents: number; bookingFeeCents: number; totalCents: number }>;

export type CreatePaymentsRouterDeps = {
  getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
  getDropInFeeBreakdown?: GetDropInFeeBreakdown;
};

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

export function createPaymentsRouter(deps?: CreatePaymentsRouterDeps) {
  const getFee = deps?.getSubscriptionBookingFeeCents;
  const getDropInFeeBreakdown = deps?.getDropInFeeBreakdown;

  return {
    ...(getDropInFeeBreakdown && {
      /**
       * Returns fee breakdown for drop-in checkout (class price, booking fee, total).
       */
      getDropInFeeBreakdown: protectedProcedure
        .use(requireCollections("lessons", "tenants"))
        .input(
          z.object({
            lessonId: z.number(),
            classPriceCents: z.number().min(0),
          })
        )
        .query(({ ctx, input }) =>
          getDropInFeeBreakdown({
            payload: ctx.payload,
            lessonId: input.lessonId,
            classPriceCents: input.classPriceCents,
          })
        ),
    }),
    /**
     * Create Stripe Checkout session (subscription or one-time).
     * When getSubscriptionBookingFeeCents was passed to createPaymentsRouter and mode is "subscription",
     * pass metadata.tenantId so a "Booking fee" line item is added to Checkout.
     */
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
            `${process.env.NEXT_PUBLIC_SERVER_URL}/`;
          try {
            // Next/router.push expects an internal path; normalize absolute URLs to a pathname.
            return raw.startsWith("http") ? new URL(raw).pathname : raw;
          } catch {
            return "/";
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

      const lineItems: Stripe.Checkout.SessionCreateParams["line_items"] = [
        { price: input.priceId, quantity: input.quantity || 1 },
      ];

      const meta = input.metadata ?? {};
      const tenantIdRaw = meta.tenantId;
      if (
        input.mode === "subscription" &&
        getFee &&
        ctx.payload &&
        typeof tenantIdRaw === "string"
      ) {
        const tenantId = parseInt(tenantIdRaw, 10);
        if (Number.isFinite(tenantId)) {
          try {
            const priceObj = await ctx.stripe.prices.retrieve(input.priceId, {
              expand: [],
            });
            const unitAmount = priceObj.unit_amount ?? 0;
            const quantity = input.quantity || 1;
            const classPriceAmountCents = unitAmount * quantity;
            const feeCents = await getFee({
              payload: ctx.payload,
              tenantId,
              classPriceAmountCents,
              metadata: meta,
            });
            if (typeof feeCents === "number" && feeCents > 0) {
              const currency = (priceObj.currency ?? "eur").toLowerCase();
              lineItems.push({
                quantity: 1,
                price_data: {
                  currency,
                  product_data: {
                    name: "Booking fee",
                    description: "Platform booking fee",
                  },
                  unit_amount: feeCents,
                },
              });
            }
          } catch (e) {
            console.warn("Subscription booking fee lookup failed", e);
          }
        }
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        line_items: lineItems,
        metadata: meta,
        mode: input.mode,
        customer: customerId,
        success_url:
          input.successUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
        cancel_url:
          input.cancelUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
      };
      if (input.mode === "subscription") {
        sessionParams.subscription_data = { metadata: meta };
      }
      const session = await ctx.stripe.checkout.sessions.create(
        sessionParams
      );

      return session;
    }),
  createCustomerPortal: stripeProtectedProcedure
    .input(z.object({ returnUrl: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const customerId = getStripeCustomerId(ctx.user);
      const returnUrl =
        input?.returnUrl ||
        `${process.env.NEXT_PUBLIC_SERVER_URL}/`;

      const session = await ctx.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session;
    }),
  createCustomerUpgradePortal: stripeProtectedProcedure
    .use(requireCollections("plans"))
    .input(
      z.object({
        productId: z.string(),
        returnUrl: z.string().optional(),
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

      const returnUrl =
        input.returnUrl || `${process.env.NEXT_PUBLIC_SERVER_URL}/`;
      const session = await ctx.stripe.billingPortal.sessions.create({
        customer: customerId,
        configuration: configId,
        return_url: returnUrl,
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
}

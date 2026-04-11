import { stripe } from "@repo/shared-utils";
import { headers } from "next/headers.js";
import { APIError, type PayloadHandler } from "payload";
import type Stripe from "stripe";
import type { User } from "@repo/shared-types";
import type { GetSubscriptionBookingFeeCents } from "../../types.js";
import type { GetStripeAccountIdForRequest } from "../../types.js";
import { ensureStripeCustomerIdForAccount } from "../../payments/lib/ensure-stripe-customer";

type CreateCheckoutSessionOptions = {
  getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
  /**
   * When provided, allows creating Checkout sessions on a tenant's connected account.
   * Used for "Option A" migrations where tenant Connect is source-of-truth for memberships.
   */
  getStripeAccountIdForRequest?: GetStripeAccountIdForRequest;
  /** Which Stripe account to create the session on. Defaults to "platform". */
  scope?: "platform" | "auto" | "connect";
  /**
   * Optional Connect application fee taken from each subscription invoice total.
   * Only applied when the subscription is created on a connected account (scope=auto/connect).
   */
  subscriptionApplicationFeePercent?: number;
  /**
   * Unit tests default to short-circuiting Stripe network calls.
   * When true, forces the handler to execute Stripe logic even in test mode.
   */
  disableTestShortCircuit?: boolean;
};

/**
 * Creates a Stripe Checkout session for subscription signup.
 * When getSubscriptionBookingFeeCents is provided and metadata.tenantId is set,
 * adds a second line item "Booking fee" so the fee is visible in Checkout.
 */
function createCheckoutSessionImpl(options?: CreateCheckoutSessionOptions): PayloadHandler {
  return async (req): Promise<Response> => {
    if (!req.json) throw new APIError("Invalid request body", 400);
    const { user } = req;
    if (!user) throw new APIError("Unauthorized", 401);
    if (user.collection !== "users") throw new APIError("Invalid user type", 400);
    const userAsUser = user as unknown as User;
    const { price, quantity = 1, metadata } = await req.json();
    const origin =
      (await headers()).get("origin") ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      "http://localhost:3000";
    const successUrl = `${origin}/dashboard`;
    const cancelUrl = `${origin}/dashboard`;

    if (
      (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") &&
      options?.disableTestShortCircuit !== true
    ) {
      return new Response(
        JSON.stringify({ client_secret: "", url: "/dashboard" }),
        { status: 200 }
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams["line_items"] = [
      { quantity, price },
    ];

    const scope = options?.scope ?? "platform";
    const resolvedAccountId =
      scope === "platform"
        ? null
        : await Promise.resolve(options?.getStripeAccountIdForRequest?.(req) ?? null);

    if (scope === "connect" && !resolvedAccountId) {
      throw new APIError("No connected Stripe account resolved for this request", 400);
    }

    const getFee = options?.getSubscriptionBookingFeeCents;
    const meta = metadata ?? {};
    const tenantIdRaw = meta.tenantId;
    if (getFee && req.payload && typeof tenantIdRaw === "string") {
      const tenantId = parseInt(tenantIdRaw, 10);
      if (Number.isFinite(tenantId)) {
        try {
          const priceObj = await stripe.prices.retrieve(
            price,
            { expand: [] },
            resolvedAccountId ? { stripeAccount: resolvedAccountId } : undefined
          );
          const unitAmount = priceObj.unit_amount ?? 0;
          const classPriceAmountCents = unitAmount * quantity;
          const feeCents = await getFee({
            payload: req.payload,
            tenantId,
            classPriceAmountCents,
            metadata: meta,
          });
          if (typeof feeCents === "number" && feeCents > 0) {
            const currency = (priceObj.currency ?? "eur").toLowerCase();
            const recurring = priceObj.recurring;
            if (!recurring) {
              throw new Error("Subscription booking fee requires a recurring plan price");
            }
            lineItems.push({
              quantity: 1,
              price_data: {
                currency,
                product_data: {
                  name: "Booking fee",
                  description: "Platform booking fee",
                },
                unit_amount: feeCents,
                recurring: {
                  interval: recurring.interval,
                  interval_count: recurring.interval_count ?? 1,
                },
              },
            });
          }
        } catch (e) {
          console.warn("Subscription booking fee lookup failed", e);
        }
      }
    }

    try {
      const { stripeCustomerId } = await ensureStripeCustomerIdForAccount({
        payload: req.payload,
        userId: userAsUser.id as unknown as number,
        email: userAsUser.email,
        name: (userAsUser as any).name ?? null,
        stripeAccountId: resolvedAccountId,
      });

      const checkoutSession: Stripe.Checkout.Session =
        await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: lineItems,
          customer: stripeCustomerId || undefined,
          success_url: successUrl,
          cancel_url: cancelUrl,
          subscription_data: {
            metadata: meta,
            ...(resolvedAccountId &&
            typeof options?.subscriptionApplicationFeePercent === "number" &&
            options.subscriptionApplicationFeePercent > 0
              ? { application_fee_percent: options.subscriptionApplicationFeePercent }
              : {}),
          },
        }, resolvedAccountId ? { stripeAccount: resolvedAccountId } : undefined);
      return new Response(
        JSON.stringify({
          client_secret: checkoutSession.client_secret,
          url: checkoutSession.url,
        }),
        { status: 200 }
      );
    } catch (error) {
      console.log("ERROR", error);
      return new Response(
        JSON.stringify({
          message: "There was an issue creating a checkout session",
          status: 500,
        }),
        { status: 500 }
      );
    }
  };
}

export const createCheckoutSession = createCheckoutSessionImpl;

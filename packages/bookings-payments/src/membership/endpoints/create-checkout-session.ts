"use server";

import { stripe } from "@repo/shared-utils";
import { headers } from "next/headers.js";
import { APIError, type PayloadHandler } from "payload";
import type Stripe from "stripe";
import type { User } from "@repo/shared-types";
import type { GetSubscriptionBookingFeeCents } from "../../types.js";

type CreateCheckoutSessionOptions = {
  getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
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

    if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
      return new Response(
        JSON.stringify({ client_secret: "", url: "/dashboard" }),
        { status: 200 }
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams["line_items"] = [
      { quantity, price },
    ];

    const getFee = options?.getSubscriptionBookingFeeCents;
    const meta = metadata ?? {};
    const tenantIdRaw = meta.tenantId;
    if (getFee && req.payload && typeof tenantIdRaw === "string") {
      const tenantId = parseInt(tenantIdRaw, 10);
      if (Number.isFinite(tenantId)) {
        try {
          const priceObj = await stripe.prices.retrieve(price, { expand: [] });
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

    try {
      const checkoutSession: Stripe.Checkout.Session =
        await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: lineItems,
          customer: userAsUser.stripeCustomerId || undefined,
          success_url: successUrl,
          cancel_url: cancelUrl,
          subscription_data: { metadata: meta },
        });
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

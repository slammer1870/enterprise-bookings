"use server";

import { stripe } from "@repo/shared-utils";

import { headers } from "next/headers";

import { APIError, PayloadHandler } from "payload";

import Stripe from "stripe";

import { User } from "@repo/shared-types";

export const createCheckoutSession: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req;

  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  if (user.collection !== "users") {
    throw new APIError("Invalid user type", 400);
  }

  const userAsUser = user as unknown as User;

  const { price, quantity = 1, metadata } = await req.json();

  const origin =
    (await headers()).get("origin") ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000";

  const successUrl = `${origin}/dashboard`;
  const cancelUrl = `${origin}/dashboard`;

  // E2E/CI: don't call Stripe. We only need a redirect URL to keep the booking flow deterministic.
  // Playwright configs set ENABLE_TEST_WEBHOOKS=true; using it here avoids external dependency flakes.
  if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
    return new Response(
      JSON.stringify({
        client_secret: "",
        url: "/dashboard",
      }),
      {
        status: 200,
      }
    );
  }

  try {
    const checkoutSession: Stripe.Checkout.Session =
      await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            quantity: quantity,
            price: price,
          },
        ],
        customer: userAsUser.stripeCustomerId || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: metadata,
        },
      });

    return new Response(
      JSON.stringify({
        client_secret: checkoutSession.client_secret,
        url: checkoutSession.url,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.log("ERROR", error);
    return new Response(
      JSON.stringify({
        message: "There was an issue creating a checkout session",
        status: 500,
      })
    );
  }
};

"use server";

import { stripe } from "@repo/shared-utils";

import { headers } from "next/headers";

import { APIError, PayloadHandler } from "payload";

import Stripe from "stripe";

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

  const { price, quantity = 1, metadata } = await req.json();

  console.log("METADATA FROM ENDPOINT", metadata);

  console.log("origin", (await headers()).get("origin"));

  const origin =
    (await headers()).get("origin") ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000";

  const successUrl = `${origin}/success`;
  const cancelUrl = `${origin}/cancel`;

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
        customer: user.stripeCustomerId || undefined,
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

"use server";

import { stripe } from "@repo/shared-utils";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { APIError, PayloadHandler } from "payload";

import Stripe from "stripe";

export const createCustomerPortal: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req;

  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  if (!user.stripeCustomerId) {
    throw new APIError("User has no Stripe customer ID", 400);
  }

  const origin =
    (await headers()).get("origin") ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000";

  try {
    const portalSession: Stripe.BillingPortal.Session =
      await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId as string,
        return_url: `${origin}/dashboard`,
      });

    return new Response(
      JSON.stringify({
        url: portalSession.url,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.log("ERROR", error);
    return new Response(
      JSON.stringify({
        message: "There was an issue creating a customer portal session",
        status: 500,
      })
    );
  }
};

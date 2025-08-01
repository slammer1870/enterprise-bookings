"use server";

import { stripe, formatAmountForStripe } from "@repo/shared-utils";

import { APIError, PayloadHandler } from "payload";

import { User } from "@repo/shared-types";

export const createPaymentIntent: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req as unknown as { user: User };

  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  const { price, metadata } = await req.json();

  let amount = price;

  // Apply quantity-based discount if a dropInId is provided

  const userQuery = (await req.payload.findByID({
    collection: "users",
    id: user.id,
  })) as User;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(amount, "eur"),
    automatic_payment_methods: { enabled: true },
    currency: "eur",
    receipt_email: user.email,
    customer: userQuery.stripeCustomerId || undefined,
    metadata: metadata,
  });

  return new Response(
    JSON.stringify({
      clientSecret: paymentIntent.client_secret as string,
      amount: amount,
    }),
    {
      status: 200,
    }
  );
};

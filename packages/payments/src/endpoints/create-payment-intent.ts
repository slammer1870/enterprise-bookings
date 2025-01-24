"use server";

import { stripe, formatAmountForStripe } from "@repo/shared-utils";

import { APIError, PayloadHandler } from "payload";

export const createPaymentIntent: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req;

  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  const { price, quantity = 1, lessonId } = await req.json();

  let amount: number = price;

  if (quantity > 1) {
    amount = price * quantity;
  }

  const metadata: { [key: string]: string } = {};
  if (lessonId) {
    metadata.lessonId = lessonId;
    metadata.userId = user.id.toString();
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(amount, "eur"),
    automatic_payment_methods: { enabled: true },
    currency: "eur",
    receipt_email: user.email,
    customer: user.stripeCustomerId || undefined,
    metadata: metadata,
  });

  return new Response(
    JSON.stringify({ clientSecret: paymentIntent.client_secret as string }),
    {
      status: 200,
    }
  );
};

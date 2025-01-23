"use server";

import { stripe, formatAmountForStripe } from "@repo/shared-utils";
import { APIError, PayloadHandler } from "payload";
import Stripe from "stripe";

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

  const { price, quantity = 1, lesson_id } = await req.json();

  let amount: number = price;

  if (quantity > 1) {
    amount = price * quantity;
  }

  const metadata: { [key: string]: string } = {};
  if (lesson_id) {
    metadata.lesson_id = lesson_id;
    metadata.user_id = user.id.toString();
  }

  const paymentIntent: Stripe.PaymentIntent =
    await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount, "eur"),
      automatic_payment_methods: { enabled: true },
      currency: "eur",
      receipt_email: user.email,
      customer: user.stripeCustomerID || undefined,
      metadata: metadata,
    });

  return new Response(
    JSON.stringify({ client_secret: paymentIntent.client_secret as string }),
    {
      status: 200,
    }
  );
};

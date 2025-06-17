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

  const { price, lessonId } = await req.json();

  let amount = price;

  // Apply quantity-based discount if a dropInId is provided

  const metadata: { [key: string]: string } = {};
  if (lessonId) {
    metadata.lessonId = lessonId;
    metadata.userId = user.id.toString();
  }

  const userQuery = await req.payload.findByID({
    collection: "users",
    id: user.id,
  });

  const customer = await stripe.customers.retrieve(userQuery.stripeCustomerId);

  if (!customer) {
    const customer = await stripe.customers.create({
      name: userQuery.name,
      email: userQuery.email,
    });

    console.log("customer", customer);

    await req.payload.update({
      collection: "users",
      id: user.id,
      data: { stripeCustomerId: customer.id },
    });
  }

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

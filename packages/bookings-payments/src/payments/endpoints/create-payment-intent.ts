import type { PayloadHandler } from "payload";
import { stripe, formatAmountForStripe } from "@repo/shared-utils";
import { APIError } from "payload";
import type { User } from "@repo/shared-types";

export const createPaymentIntent: PayloadHandler = async (req): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req as unknown as { user: User };
  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  const { price, metadata } = await req.json();

  const userQuery = (await req.payload.findByID({
    collection: "users",
    id: user.id,
  })) as User;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(price, "eur"),
    automatic_payment_methods: { enabled: true },
    currency: "eur",
    receipt_email: userQuery.email,
    customer: userQuery.stripeCustomerId || undefined,
    metadata: metadata ?? {},
  });

  return new Response(
    JSON.stringify({ clientSecret: paymentIntent.client_secret as string, amount: price }),
    { status: 200 }
  );
};

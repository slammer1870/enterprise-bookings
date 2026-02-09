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

  // E2E/CI: avoid calling Stripe (network) and return a deterministic response.
  // The UI only needs a clientSecret string to render; tests can still assert on request payloads.
  if (process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_WEBHOOKS === "true") {
    // IMPORTANT: Stripe Elements validates the client secret format.
    // It must look like `pi_<id>_secret_<secret>` (and NOT `pi_test_*`), otherwise Stripe.js throws
    // an IntegrationError and the page crashes (breaking E2E).
    return new Response(
      JSON.stringify({
        clientSecret: `pi_${Date.now()}_secret_test`,
        amount: price,
        metadata: metadata ?? {},
      }),
      { status: 200 }
    );
  }

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

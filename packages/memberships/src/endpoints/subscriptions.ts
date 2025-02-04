import { type PayloadHandler } from "payload";

import { checkRole, stripe } from "@repo/shared-utils";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

// use this handler to get all Stripe customers
// prevents unauthorized or non-admin users from accessing all Stripe customers
// GET /api/subscriptions
export const subscriptionsProxy: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.user || !checkRole(["admin"], req.user as any)) {
    if (logs)
      req.payload.logger.error({
        err: `You are not authorized to access subscriptions`,
      });
    return new Response(
      JSON.stringify("You are not authorized to access subscriptions"),
      {
        status: 401,
      }
    ); // Ensure to return a Response object
  }

  if (!req.json) {
    if (logs) req.payload.logger.error({ err: `Request body is undefined` });
    return new Response(JSON.stringify("Request body is undefined"), {
      status: 400,
    });
  }

  const { user } = await req.json();

  const stripeUser = await req.payload.findByID({
    collection: "users",
    id: user,
  });

  try {
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      expand: ["data.customer"],
      customer: stripeUser.stripeCustomerID || "",
    });

    return new Response(JSON.stringify(subscriptions), {
      status: 200,
    });
  } catch (error: unknown) {
    if (logs)
      req.payload.logger.error({ err: `Error using Stripe API: ${error}` });
    return new Response(JSON.stringify(`Error using Stripe API: ${error}`), {
      status: 500,
    });
  }
};

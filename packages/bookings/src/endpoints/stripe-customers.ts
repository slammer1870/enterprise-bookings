import { type PayloadHandler } from "payload";

import { stripe } from "../lib/stripe";

import { checkRole } from "@repo/shared-utils/src/check-role";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

// use this handler to get all Stripe customers
// prevents unauthorized or non-admin users from accessing all Stripe customers
// GET /api/customers
export const customersProxy: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.user || !checkRole(["admin"], req.user as any)) {
    if (logs)
      req.payload.logger.error({
        err: `You are not authorized to access customers`,
      });
    return new Response(
      JSON.stringify("You are not authorized to access customers"),
      {
        status: 401,
      }
    ); // Ensure to return a Response object
  }

  try {
    const customers = await stripe.customers.list({
      limit: 100,
    });

    return new Response(JSON.stringify(customers), {
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

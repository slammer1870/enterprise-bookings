import { type PayloadHandler } from "payload";

import { checkRole, stripe } from "@repo/shared-utils";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

// use this handler to get all Stripe products
// prevents unauthorized or non-admin users from accessing all Stripe products
// GET /api/products
export const plansProxy: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user || !checkRole(["admin"], req.user as any)) {
    if (logs)
      req.payload.logger.error({
        err: `You are not authorized to access products`,
      });
    return new Response(
      JSON.stringify("You are not authorized to access products"),
      {
        status: 401,
      }
    );
  }
  try {
    const products = await stripe.products
      .list({
        limit: 100,
        expand: ["data.default_price"],
      })
      .autoPagingToArray({ limit: 1000 });

    if (logs) {
      req.payload.logger.info({
        msg: "Stripe products fetched",
        count: products.length,
      });
    }

    const plans = products.filter(
      (product) =>
        typeof product.default_price === "object" &&
        product.default_price?.type === "recurring"
    );

    return new Response(JSON.stringify({ data: plans }), {
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

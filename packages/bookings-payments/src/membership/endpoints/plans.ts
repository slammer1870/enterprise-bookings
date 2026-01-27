import type { PayloadHandler } from "payload";
import { checkRole, stripe } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

export const plansProxy: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user || !checkRole(["admin"], req.user as unknown as User | null)) {
    if (logs) req.payload.logger?.error?.({ err: "You are not authorized to access products" });
    return new Response(JSON.stringify("You are not authorized to access products"), {
      status: 401,
    });
  }
  try {
    const products = await stripe.products
      .list({ limit: 100, expand: ["data.default_price"] })
      .autoPagingToArray({ limit: 1000 });
    if (logs) req.payload.logger?.info?.({ msg: "Stripe products fetched", count: products.length });
    const plans = products.filter(
      (p) =>
        typeof p.default_price === "object" &&
        p.default_price?.type === "recurring"
    );
    return new Response(JSON.stringify({ data: plans }), { status: 200 });
  } catch (error: unknown) {
    if (logs) req.payload.logger?.error?.({ err: `Error using Stripe API: ${error}` });
    return new Response(JSON.stringify(`Error using Stripe API: ${error}`), { status: 500 });
  }
};

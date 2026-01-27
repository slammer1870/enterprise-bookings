import type { PayloadHandler } from "payload";
import { checkRole, stripe } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

export const subscriptionsProxy: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user || !checkRole(["admin"], req.user as unknown as User | null)) {
    if (logs) req.payload.logger?.error?.({ err: "You are not authorized to access subscriptions" });
    return new Response(JSON.stringify("You are not authorized to access subscriptions"), {
      status: 401,
    });
  }
  try {
    const subscriptions = await stripe.subscriptions
      .list({ limit: 100, expand: ["data.customer"] })
      .autoPagingToArray({ limit: 1000 });
    return new Response(JSON.stringify({ data: subscriptions }), { status: 200 });
  } catch (error: unknown) {
    if (logs) req.payload.logger?.error?.({ err: `Error using Stripe API: ${error}` });
    return new Response(JSON.stringify(`Error using Stripe API: ${error}`), { status: 500 });
  }
};

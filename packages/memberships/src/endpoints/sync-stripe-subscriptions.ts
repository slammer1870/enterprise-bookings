import { APIError, PayloadHandler } from "payload";

import { User } from "@repo/shared-types";
import { syncStripeSubscriptions } from "../lib/sync-stripe-subscriptions";

export const syncStripeSubscriptionsEndpoint: PayloadHandler = async (
  req
): Promise<Response> => {
  const { user } = req as { user: User };

  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  try {
    const newSubscriptions = await syncStripeSubscriptions(req.payload);
    return new Response(JSON.stringify({ success: true, newSubscriptions }), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      {
        status: 500,
      }
    );
  }
};

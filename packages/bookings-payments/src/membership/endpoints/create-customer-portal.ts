import { stripe } from "@repo/shared-utils";
import { headers } from "next/headers";
import { APIError, type PayloadHandler } from "payload";
import type { User } from "@repo/shared-types";
import type { GetStripeAccountIdForRequest } from "../../types.js";
import { ensureStripeCustomerIdForAccount } from "../../payments/lib/ensure-stripe-customer";

export type CreateCustomerPortalOptions = {
  getStripeAccountIdForRequest?: GetStripeAccountIdForRequest;
  scope?: "platform" | "auto" | "connect";
};

export function createCustomerPortalFactory(options?: CreateCustomerPortalOptions): PayloadHandler {
  return async (req): Promise<Response> => {
    if (!req.json) throw new APIError("Invalid request body", 400);
    const { user } = req;
    if (!user) throw new APIError("Unauthorized", 401);
    const userAsUser = user as unknown as User;

    const origin =
      (await headers()).get("origin") ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      "http://localhost:3000";

    const scope = options?.scope ?? "platform";
    const resolvedAccountId =
      scope === "platform"
        ? null
        : await Promise.resolve(options?.getStripeAccountIdForRequest?.(req) ?? null);

    if (scope === "connect" && !resolvedAccountId) {
      throw new APIError("No connected Stripe account resolved for this request", 400);
    }

    try {
      const { stripeCustomerId } = await ensureStripeCustomerIdForAccount({
        payload: req.payload,
        userId: userAsUser.id as unknown as number,
        email: userAsUser.email,
        name: (userAsUser as any).name ?? null,
        stripeAccountId: resolvedAccountId,
      });

      const portalSession = await stripe.billingPortal.sessions.create(
        {
          customer: stripeCustomerId as string,
          return_url: `${origin}/dashboard`,
        },
        resolvedAccountId ? { stripeAccount: resolvedAccountId } : undefined
      );
      return new Response(JSON.stringify({ url: portalSession.url }), { status: 200 });
    } catch (error) {
      console.log("ERROR", error);
      return new Response(
        JSON.stringify({
          message: "There was an issue creating a customer portal session",
          status: 500,
        }),
        { status: 500 }
      );
    }
  };
}

/** Backwards-compatible platform handler. */
export const createCustomerPortal: PayloadHandler = createCustomerPortalFactory();

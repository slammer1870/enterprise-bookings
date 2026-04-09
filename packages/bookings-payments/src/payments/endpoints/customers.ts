import type { PayloadHandler } from "payload";
import { stripe, checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { GetStripeAccountIdForRequest } from "../../types";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

export type CustomersProxyScope = "platform" | "auto" | "connect";

export function createCustomersProxy(params?: {
  getStripeAccountIdForRequest?: GetStripeAccountIdForRequest;
  scope?: CustomersProxyScope;
}): PayloadHandler {
  return async (req): Promise<Response> => {
    if (
      !req.user ||
      !checkRole(["super-admin", "admin", "staff"], req.user as unknown as User | null)
    ) {
      if (logs) req.payload.logger?.error?.({ err: "You are not authorized to access customers" });
      return new Response(JSON.stringify("You are not authorized to access customers"), { status: 401 });
    }

    try {
      const scope = params?.scope ?? "platform";
      const accountId =
        scope === "platform"
          ? null
          : await Promise.resolve(params?.getStripeAccountIdForRequest?.(req) ?? null);

      if (scope === "connect" && !accountId) {
        return new Response(JSON.stringify("No connected Stripe account resolved for this request"), {
          status: 400,
        });
      }

      const customers = await stripe.customers
        .list({ limit: 100 }, accountId ? { stripeAccount: accountId } : undefined)
        .autoPagingToArray({ limit: 1000 });
      return new Response(
        JSON.stringify({ data: customers, meta: { stripeAccountId: accountId ?? null } }),
        { status: 200 }
      );
    } catch (error: unknown) {
      if (logs) req.payload.logger?.error?.({ err: `Error using Stripe API: ${error}` });
      return new Response(JSON.stringify(`Error using Stripe API: ${error}`), { status: 500 });
    }
  };
}

/** Default proxy (platform Stripe); use createCustomersProxy({ ..., scope: 'auto' | 'connect' }) for tenant Connect. */
export const customersProxy: PayloadHandler = createCustomersProxy();

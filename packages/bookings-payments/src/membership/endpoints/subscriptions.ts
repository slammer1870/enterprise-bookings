import type { PayloadHandler } from "payload";
import { checkRole, stripe } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { MembershipConfig } from "../../types";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

export function createSubscriptionsProxy(membership: MembershipConfig): PayloadHandler {
  return async (req): Promise<Response> => {
    if (
      !req.user ||
      !checkRole(["super-admin", "admin", "staff"], req.user as unknown as User | null)
    ) {
      if (logs) req.payload.logger?.error?.({ err: "You are not authorized to access subscriptions" });
      return new Response(JSON.stringify("You are not authorized to access subscriptions"), {
        status: 401,
      });
    }
    try {
      const scope = membership.subscriptionsProxyScope ?? "platform";
      const accountId =
        scope === "platform"
          ? null
          : await Promise.resolve(membership.getStripeAccountIdForRequest?.(req) ?? null);

      if (scope === "connect" && !accountId) {
        return new Response(JSON.stringify("No connected Stripe account resolved for this request"), {
          status: 400,
        });
      }

      const subscriptions = await stripe.subscriptions
        .list({ limit: 100, expand: ["data.customer"] }, accountId ? { stripeAccount: accountId } : undefined)
        .autoPagingToArray({ limit: 1000 });
      // Default to “active-ish” subscriptions for admin pickers; IDs can still be pasted manually.
      const filtered = subscriptions.filter((s: any) =>
        ["active", "trialing", "past_due"].includes(String(s?.status ?? ""))
      );
      return new Response(
        JSON.stringify({ data: filtered, meta: { stripeAccountId: accountId ?? null } }),
        { status: 200 }
      );
    } catch (error: unknown) {
      if (logs) req.payload.logger?.error?.({ err: `Error using Stripe API: ${error}` });
      return new Response(JSON.stringify(`Error using Stripe API: ${error}`), { status: 500 });
    }
  };
}

/** Default proxy (platform Stripe); use createSubscriptionsProxy(membership) for tenant Connect. */
export const subscriptionsProxy: PayloadHandler = createSubscriptionsProxy({ enabled: true });

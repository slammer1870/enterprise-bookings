import type { PayloadHandler } from "payload";
import { checkRole, stripe } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { MembershipConfig } from "../../types";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

export function createPlansProxy(membership: MembershipConfig): PayloadHandler {
  return async (req): Promise<Response> => {
    if (
      !req.user ||
      !checkRole(["super-admin", "admin", "staff"], req.user as unknown as User | null)
    ) {
      if (logs) req.payload.logger?.error?.({ err: "You are not authorized to access products" });
      return new Response(JSON.stringify("You are not authorized to access products"), {
        status: 401,
      });
    }
    try {
      // Backwards compatibility:
      // - Historically, if getStripeAccountIdForRequest was provided and returned an acct, we listed from Connect.
      // - If no resolver is provided, list from platform.
      // Connect-first apps can set membership.scope to "connect" to require tenant context.
      const scope =
        membership.scope ??
        (membership.getStripeAccountIdForRequest ? "auto" : "platform");
      const accountId =
        scope === "platform"
          ? null
          : await Promise.resolve(membership.getStripeAccountIdForRequest?.(req) ?? null);

      if (scope === "connect" && !accountId) {
        return new Response(JSON.stringify("No connected Stripe account resolved for this request"), {
          status: 400,
        });
      }

      const listParams = {
        limit: 100,
        expand: ["data.default_price"],
      };
      const products = await stripe.products
        .list(listParams, accountId ? { stripeAccount: accountId } : undefined)
        .autoPagingToArray({ limit: 1000 });
      if (logs) req.payload.logger?.info?.({ msg: "Stripe products fetched", count: products.length });
      const plans = products.filter(
        (p) =>
          typeof p.default_price === "object" &&
          p.default_price?.type === "recurring"
      );
      return new Response(
        JSON.stringify({ data: plans, meta: { stripeAccountId: accountId ?? null } }),
        { status: 200 }
      );
    } catch (error: unknown) {
      if (logs) req.payload.logger?.error?.({ err: `Error using Stripe API: ${error}` });
      return new Response(JSON.stringify(`Error using Stripe API: ${error}`), { status: 500 });
    }
  };
}

/** Default proxy (platform Stripe); use createPlansProxy(membership) for tenant Connect. */
export const plansProxy = createPlansProxy({ enabled: true });

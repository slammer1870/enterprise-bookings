import type { CollectionBeforeChangeHook, Payload } from "payload";
import { stripe } from "@repo/shared-utils";
import type Stripe from "stripe";
import type { MembershipConfig } from "../../types";

const logs = false;

function normalizeAccountId(accountId: string | null | undefined): string | null {
  const a = typeof accountId === "string" ? accountId.trim() : "";
  return a ? a : null;
}

function getUserIdFromData(user: unknown): number | null {
  if (typeof user === "number" && Number.isFinite(user)) return user;
  if (typeof user === "string" && user.trim()) {
    const n = parseInt(user, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof user === "object" && user !== null && "id" in user) {
    const id = (user as { id: unknown }).id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string" && id.trim()) {
      const n = parseInt(id, 10);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function getConnectStripeCustomerId(user: any, stripeAccountId: string): string | null {
  const arr = Array.isArray(user?.stripeCustomers) ? user.stripeCustomers : [];
  const found = arr.find(
    (x: any) =>
      x &&
      typeof x === "object" &&
      x.stripeAccountId === stripeAccountId &&
      typeof x.stripeCustomerId === "string" &&
      x.stripeCustomerId.trim()
  );
  return found ? String(found.stripeCustomerId).trim() : null;
}

async function upsertConnectMapping(params: {
  payload: Payload;
  req: any;
  userId: number;
  stripeAccountId: string;
  stripeCustomerId: string;
}): Promise<void> {
  const { payload, userId, stripeAccountId, stripeCustomerId, req } = params;
  const user = (await payload.findByID({
    collection: "users" as any,
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as any;
  if (!user) return;
  const existing = Array.isArray(user.stripeCustomers) ? user.stripeCustomers : [];
  const next = [
    ...existing.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
    { stripeAccountId, stripeCustomerId },
  ];
  await payload.update({
    collection: "users" as any,
    id: userId,
    data: { stripeCustomers: next } as Record<string, unknown>,
    req,
    overrideAccess: true,
  });
}

export function createBeforeSubscriptionChange(config: Pick<MembershipConfig, "getStripeAccountIdForRequest" | "scope">): CollectionBeforeChangeHook {
  return async ({ data, req }) => {
    const { payload } = req;
    const newDoc: Record<string, unknown> = {
      ...data,
      skipSync: false,
    };

    if (data.skipSync) {
      if (logs) payload.logger?.info?.("Skipping subscription 'beforeChange' hook");
      return newDoc;
    }

    if (!data.stripeSubscriptionId) {
      if (logs)
        payload.logger?.info?.(
          "No Stripe subscription assigned to this document, skipping subscription 'beforeChange' hook"
        );
      return newDoc;
    }

    const scope = config.scope ?? "platform";
    const resolvedAccountId =
      scope === "platform"
        ? null
        : normalizeAccountId(await Promise.resolve(config.getStripeAccountIdForRequest?.(req) ?? null));

    if (scope === "connect" && !resolvedAccountId) {
      throw new Error("No connected Stripe account resolved for this tenant");
    }

    // If record already has stripeAccountId, require it to match the resolved tenant account.
    const existingStripeAccountId = normalizeAccountId((data as any)?.stripeAccountId);
    if (existingStripeAccountId && resolvedAccountId && existingStripeAccountId !== resolvedAccountId) {
      throw new Error("Stripe account mismatch for this subscription (tenant context changed)");
    }

    const stripeAccountIdToUse =
      scope === "platform" ? null : (resolvedAccountId ?? null);

    if (logs) payload.logger?.info?.("Looking up subscription from Stripe...");

    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(
        data.stripeSubscriptionId as string,
        { expand: ["customer"] } as any,
        stripeAccountIdToUse ? ({ stripeAccount: stripeAccountIdToUse } as any) : undefined
      ) as Stripe.Subscription;
    } catch (error: unknown) {
      payload.logger?.error?.(`Error fetching subscription from Stripe: ${error}`);
      throw new Error("Failed to retrieve subscription from Stripe");
    }

    const subscriptionCustomerId =
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer?.id;

    if (stripeAccountIdToUse) {
      if (!subscriptionCustomerId) {
        throw new Error("Stripe subscription has no customer");
      }

      const userId = getUserIdFromData((data as any)?.user);
      if (!userId) throw new Error("Subscription user is required");

      const user = (await payload.findByID({
        collection: "users" as any,
        id: userId,
        depth: 0,
        overrideAccess: true,
      })) as any;
      if (!user) throw new Error("User not found");

      const mappedCustomerId = getConnectStripeCustomerId(user, stripeAccountIdToUse);
      if (mappedCustomerId && mappedCustomerId !== subscriptionCustomerId) {
        throw new Error("Stripe subscription customer does not match this user's stored customer mapping for the tenant");
      }

      // If mapping is missing, store it based on the chosen subscription.
      if (!mappedCustomerId) {
        await upsertConnectMapping({
          payload,
          req,
          userId,
          stripeAccountId: stripeAccountIdToUse,
          stripeCustomerId: subscriptionCustomerId,
        });
      }

      newDoc.stripeAccountId = stripeAccountIdToUse;
      newDoc.stripeCustomerId = subscriptionCustomerId;
    }

    // Keep existing behavior: sync key fields from Stripe
    newDoc.startDate = new Date(stripeSubscription.current_period_start * 1000).toISOString();
    newDoc.endDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
    newDoc.status = stripeSubscription.status;
    newDoc.cancelAt = stripeSubscription.cancel_at
      ? new Date(stripeSubscription.cancel_at * 1000).toISOString()
      : null;
    newDoc.quantity = stripeSubscription.items?.data?.[0]?.quantity;

    return newDoc;
  };
}

/** Backwards-compatible default: platform Stripe. Prefer createBeforeSubscriptionChange({ ... }) when using Connect. */
export const beforeSubscriptionChange: CollectionBeforeChangeHook = createBeforeSubscriptionChange({
  scope: "platform",
});

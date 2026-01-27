import type { Payload } from "payload";
import { syncStripeSubscriptions } from "../lib/sync-stripe-subscriptions";

export type SyncStripeSubscriptionsOutput = {
  count: number;
  newSubscriptionIds?: number[];
};

/**
 * Payload job task that syncs Stripe subscriptions into Payload.
 * Registered by the bookings-payments plugin when membership is enabled.
 *
 * Multitenancy: Input may include optional `tenant` (or other context). The core
 * sync does not use it; apps that need tenant on created documents can use
 * afterCreate hooks on subscriptions/plans/users, or register a wrapper task
 * that sets req.context.tenant from input.tenant before calling this handler.
 */
export const syncStripeSubscriptionsTask = (async ({
  req,
}: {
  req: { payload: Payload };
}) => {
  const newSubscriptions = await syncStripeSubscriptions(req.payload);
  const docs = newSubscriptions as Array<{ id?: number }>;
  return {
    output: {
      count: docs.length,
      newSubscriptionIds: docs.map((d) => d.id).filter((id): id is number => id != null),
    } satisfies SyncStripeSubscriptionsOutput,
  };
// App Payload types may not include this task; cast so plugin registration type-checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin task not in app types
}) as any;

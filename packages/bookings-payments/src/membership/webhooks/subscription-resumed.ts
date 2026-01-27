import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";
import { findUserByCustomer } from "./find-user-by-customer";

export const subscriptionResumed: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;
  // Plugin-added collection slugs; app Payload types may not include them when building.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin collections not in app types
  const asCollection = (s: string): any => s;

  const { customer } = event.data.object;

  try {
    const user = await findUserByCustomer(payload, customer as string);

    if (!user) {
      payload.logger.info("Skipping subscription resume: User not found");
      return;
    }

    const subscription = await payload.find({
      collection: asCollection("subscriptions"),
      depth: 0,
      where: {
        stripeSubscriptionId: { equals: event.data.object.id },
      },
      limit: 1,
    });

    if (subscription.totalDocs === 0 || !subscription.docs[0]) {
      throw new Error("Subscription not found");
    }

    const foundSubscription = subscription.docs[0];

    // Get current_period_start and current_period_end from subscription or items
    // In newer Stripe API versions, these may only be on subscription items
    // Note: TypeScript types may not include these on SubscriptionItem, but they exist in webhook payloads
    const firstItem = event.data.object.items.data[0] as
      | (Stripe.SubscriptionItem & {
          current_period_start?: number;
          current_period_end?: number;
        })
      | undefined;
    const currentPeriodStart =
      event.data.object.current_period_start ??
      firstItem?.current_period_start;
    const currentPeriodEnd =
      event.data.object.current_period_end ?? firstItem?.current_period_end;

    await payload.update({
      collection: asCollection("subscriptions"),
      id: foundSubscription.id as number,
      data: {
        status: event.data.object.status, // Usually "active" when resumed
        startDate: currentPeriodStart
          ? new Date(currentPeriodStart * 1000).toISOString()
          : undefined,
        endDate: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : undefined,
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : null,
        skipSync: true, // Prevent Stripe API call in beforeChange hook
      },
    });
  } catch (error) {
    payload.logger.error(`Error resuming subscription: ${error}`);
    // Re-throw critical errors
    if (error instanceof Error && error.message === "Subscription not found") {
      throw error;
    }
  }
};


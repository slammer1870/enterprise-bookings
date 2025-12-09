import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";

export const subscriptionResumed: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;

  const { customer } = event.data.object;

  try {
    const user = await payload.find({
      collection: "users",
      where: { stripeCustomerId: { equals: customer } },
      limit: 1,
    });

    if (user.totalDocs === 0) {
      payload.logger.info("Skipping subscription resume: User not found");
      return;
    }

    const subscription = await payload.find({
      collection: "subscriptions",
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

    await payload.update({
      collection: "subscriptions",
      id: foundSubscription.id as number,
      data: {
        status: event.data.object.status, // Usually "active" when resumed
        startDate: new Date(
          event.data.object.current_period_start * 1000
        ).toISOString(),
        endDate: new Date(
          event.data.object.current_period_end * 1000
        ).toISOString(),
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


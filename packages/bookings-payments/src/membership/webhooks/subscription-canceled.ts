import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";
import { findUserByCustomer } from "./find-user-by-customer";

export const subscriptionCanceled: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;
  // Plugin-added collection slugs; app Payload types may not include them when building.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin collections not in app types
  const asCollection = (s: string): any => s;

  const { customer } = event.data.object;

  const planId = event.data.object.items.data[0]?.plan?.product;

  try {
    const user = await findUserByCustomer(payload, customer as string);

    if (!user) {
      payload.logger.info("Skipping subscription cancellation: User not found");
      return;
    }

    const subscription = await payload.find({
      collection: asCollection("subscriptions"),
      where: {
        stripeSubscriptionId: { equals: event.data.object.id },
      },
      depth: 0,
      limit: 1,
    });

    if (subscription.totalDocs === 0 || !subscription.docs[0]) {
      throw new Error("Subscription not found");
    }

    const foundSubscription = subscription.docs[0];
    const subscriptionUserId =
      typeof foundSubscription.user === "object"
        ? foundSubscription.user.id
        : foundSubscription.user;

    // Get current_period_end from subscription or items
    // In newer Stripe API versions, this may only be on subscription items
    // Note: TypeScript types may not include these on SubscriptionItem, but they exist in webhook payloads
    const firstItem = event.data.object.items.data[0] as
      | (Stripe.SubscriptionItem & {
          current_period_end?: number;
        })
      | undefined;
    const currentPeriodEnd =
      event.data.object.current_period_end ?? firstItem?.current_period_end;

    await payload.update({
      collection: asCollection("subscriptions"),
      id: foundSubscription.id as number,
      data: {
        status: "canceled",
        endDate: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : new Date().toISOString(),
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : new Date().toISOString(),
        skipSync: true, // Prevent Stripe API call in beforeChange hook
      },
    });

    // Only update bookings if we have a valid planId (Stripe product ID)
    if (planId) {
      // Look up the plan by Stripe product ID
      const plan = await payload.find({
        collection: asCollection("plans"),
        where: { stripeProductId: { equals: planId as string } },
        limit: 1,
      });

      if (plan.docs[0]?.id) {
        await payload.update({
          collection: "bookings",
          where: {
            user: { equals: subscriptionUserId },
            "lesson.classOption.paymentMethods.allowedPlans": {
              contains: plan.docs[0].id,
            },
            "lesson.startTime": {
              greater_than: new Date(),
            },
            status: {
              equals: "confirmed",
            },
          },
          data: {
            status: "cancelled",
          },
        });
      }
    }
  } catch (error) {
    payload.logger.error(`Error canceling subscription: ${error}`);
    // Re-throw critical errors
    if (error instanceof Error && error.message === "Subscription not found") {
      throw error;
    }
  }
};

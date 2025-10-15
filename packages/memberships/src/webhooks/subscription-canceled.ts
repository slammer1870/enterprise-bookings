import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";

export const subscriptionCanceled: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;

  const { customer } = event.data.object;

  const planId = event.data.object.items.data[0]?.plan?.product;

  try {
    const user = await payload.find({
      collection: "users",
      where: { stripeCustomerId: { equals: customer } },
      limit: 1,
    });

    if (user.totalDocs === 0) {
      return;
    }

    const subscription = await payload.find({
      collection: "subscriptions",
      where: {
        stripeSubscriptionId: { equals: event.data.object.id },
      },
    });

    if (subscription.totalDocs === 0) {
      throw new Error("Subscription not found");
    }

    await payload.update({
      collection: "subscriptions",
      id: subscription.docs[0]?.id as number,
      data: {
        status: "canceled",
        endDate: new Date().toISOString(),
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : new Date().toISOString(),
      },
    });

    // Only update bookings if we have a valid planId
    if (planId) {
      await payload.update({
        collection: "bookings",
        where: {
          user: { equals: user.docs[0]?.id as number },
          "lesson.classOption.paymentMethods.allowedPlans": {
            contains: planId,
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
  } catch (error) {
    console.error("Error canceling subscription", error);
  }
};

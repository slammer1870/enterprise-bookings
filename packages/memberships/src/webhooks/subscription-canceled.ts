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
      throw new Error("User not found");
    }

    const plan = await payload.find({
      collection: "plans",
      where: { stripeProductId: { equals: planId } },
      limit: 1,
    });

    if (plan.totalDocs === 0) {
      throw new Error("Plan not found");
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
      },
    });
  } catch (error) {
    console.error("Error canceling subscription", error);
  }
};

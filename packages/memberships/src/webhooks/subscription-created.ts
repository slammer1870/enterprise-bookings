import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";

export const subscriptionCreated: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;

  const { customer } = event.data.object;

  const planId = event.data.object.items.data[0]?.plan?.product;

  const { lessonId } = event.data.object.metadata;

  try {
    const user = await payload.find({
      collection: "users",
      where: { stripeCustomerId: { equals: customer as string } },
      limit: 1,
    });

    if (user.totalDocs === 0) {
      payload.logger.info("Skipping subscription creation: User not found");
      return;
    }

    const plan = await payload.find({
      collection: "plans",
      where: { stripeProductId: { equals: planId as string } },
      limit: 1,
    });

    if (plan.totalDocs === 0) {
      throw new Error("Plan not found");
    }

    await payload.create({
      collection: "subscriptions",
      data: {
        user: user.docs[0]?.id as number,
        plan: plan.docs[0]?.id as number,
        status: "active",
        stripeSubscriptionId: event.data.object.id as string,
      },
    });

    if (lessonId) {
      const booking = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: user.docs[0]?.id as number },
          lesson: { equals: lessonId as unknown as number },
        },
        limit: 1,
      });

      if (booking.totalDocs === 0) {
        await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonId as unknown as number,
            user: user.docs[0]?.id as number,
            status: "confirmed",
          },
        });
      } else {
        await payload.update({
          collection: "bookings",
          id: booking.docs[0]?.id as number,
          data: { status: "confirmed" },
        });
      }
    }
  } catch (error) {
    payload.logger.error(`Error creating subscription: ${error}`);
  }
};

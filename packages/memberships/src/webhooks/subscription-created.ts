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

  console.log(event.data.object);

  const { lesson_id } = event.data.object.metadata;

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

    const subscription = await payload.create({
      collection: "subscriptions",
      data: {
        user: user.docs[0]?.id,
        plan: plan.docs[0]?.id,
        status: "active",
        stripeSubscriptionId: event.data.object.id,
      },
    });

    if (lesson_id) {
      const booking = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: user.docs[0]?.id },
          lesson: { equals: lesson_id },
        },
        limit: 1,
      });

      if (booking.totalDocs === 0) {
        await payload.create({
          collection: "bookings",
          data: {
            lesson: lesson_id,
            user: user.docs[0]?.id,
            status: "confirmed",
          },
        });
      } else {
        await payload.update({
          collection: "bookings",
          id: booking.docs[0]?.id as string,
          data: { status: "confirmed" },
        });
      }
    }
  } catch (error) {
    console.error("Error creating subscription", error);
  }
};

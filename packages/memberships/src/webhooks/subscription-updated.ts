import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";

export const subscriptionUpdated: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;

  const { customer } = event.data.object;

  const planId = event.data.object.items.data[0]?.plan?.product;

  const { lesson_id } = event.data.object.metadata;

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
      depth: 0,
      where: {
        stripeSubscriptionId: { equals: event.data.object.id },
      },
    });

    if (subscription.totalDocs === 0) {
      throw new Error("Subscription not found");
    }

    await payload.update({
      collection: "subscriptions",
      where: {
        stripeSubscriptionId: { equals: event.data.object.id },
      },
      data: {
        status: event.data.object.status,
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : null,
      },
    });

    const plan = await payload.find({
      collection: "plans",
      where: { stripeProductId: { equals: planId } },
      limit: 1,
    });

    if (plan.docs[0]?.id) {
      await payload.update({
        collection: "subscriptions",
        where: {
          stripeSubscriptionId: { equals: event.data.object.id },
        },
        data: {
          plan: plan.docs[0]?.id,
        },
      });
    }

    if (lesson_id) {
      const booking = await payload.find({
        collection: "bookings",
        where: {
          user: {
            in: subscription.docs.map((subscription) => subscription.user),
          },
          lesson: { equals: lesson_id as unknown as number },
        },
        limit: 1,
      });

      if (booking.totalDocs === 0) {
        await payload.create({
          collection: "bookings",
          data: {
            lesson: lesson_id as unknown as number,
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
    console.error("Error updating subscription", error);
  }
};

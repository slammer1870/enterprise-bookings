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
        skipSync: true, // Prevent Stripe API call in beforeChange hook
      },
    });

    if (lessonId) {
      // Convert lessonId to number and verify it exists
      const lessonIdNum = Number(lessonId);
      if (isNaN(lessonIdNum)) {
        payload.logger.error(`Invalid lessonId in metadata: ${lessonId}`);
        return;
      }

      // Verify lesson exists
      try {
        await payload.findByID({
          collection: "lessons",
          id: lessonIdNum,
        });
      } catch (error) {
        payload.logger.error(`Lesson not found: ${lessonIdNum}`);
        return;
      }

      const booking = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: user.docs[0]?.id as number },
          lesson: { equals: lessonIdNum },
        },
        limit: 1,
      });

      if (booking.totalDocs === 0) {
        await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonIdNum,
            user: user.docs[0]?.id as number,
            status: "confirmed",
          },
          overrideAccess: true, // Bypass access control for webhook
        });
      } else {
        await payload.update({
          collection: "bookings",
          id: booking.docs[0]?.id as number,
          data: { status: "confirmed" },
          overrideAccess: true, // Bypass access control for webhook
        });
      }
    }
  } catch (error) {
    payload.logger.error(`Error creating subscription: ${error}`);
    // Re-throw critical errors
    if (error instanceof Error && error.message === "Plan not found") {
      throw error;
    }
  }
};

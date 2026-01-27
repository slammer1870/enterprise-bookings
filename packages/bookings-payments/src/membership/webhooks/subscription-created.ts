import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";
import { findUserByCustomer } from "./find-user-by-customer";

export const subscriptionCreated: StripeWebhookHandler<{
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

  const { lessonId } = event.data.object.metadata;

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
    event.data.object.current_period_start ?? firstItem?.current_period_start;
  const currentPeriodEnd =
    event.data.object.current_period_end ?? firstItem?.current_period_end;

  try {
    const user = await findUserByCustomer(payload, customer as string);

    if (!user) {
      payload.logger.info("Skipping subscription creation: User not found");
      return;
    }

    const plan = await payload.find({
      collection: asCollection("plans"),
      where: { stripeProductId: { equals: planId as string } },
      limit: 1,
    });

    if (plan.totalDocs === 0) {
      throw new Error("Plan not found");
    }

    await payload.create({
      collection: asCollection("subscriptions"),
      data: {
        user: user.id as number,
        plan: plan.docs[0]?.id as number,
        status: "active",
        stripeSubscriptionId: event.data.object.id as string,
        startDate: currentPeriodStart
          ? new Date(currentPeriodStart * 1000).toISOString()
          : null,
        endDate: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : null,
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
          user: { equals: user.id as number },
          lesson: { equals: lessonIdNum },
        },
        limit: 1,
      });

      if (booking.totalDocs === 0) {
        await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonIdNum,
            user: user.id as number,
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

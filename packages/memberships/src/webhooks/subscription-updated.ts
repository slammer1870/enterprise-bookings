import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import Stripe from "stripe";
import { findUserByCustomer } from "./find-user-by-customer";

export const subscriptionUpdated: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription;
  };
}> = async (args) => {
  const { event, payload } = args;

  const { customer } = event.data.object;

  payload.logger.info(
    `Updating subscription ${event.data.object.id} for customer ${customer}`
  );

  const planId = event.data.object.items.data[0]?.plan?.product;

  // Support both camelCase and snake_case for backward compatibility
  const lessonId =
    event.data.object.metadata.lessonId || event.data.object.metadata.lesson_id;

  try {
    const user = await findUserByCustomer(payload, customer as string);

    if (!user) {
      payload.logger.info("Skipping subscription update: User not found");
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
    const subscriptionUserId =
      typeof foundSubscription.user === "object"
        ? foundSubscription.user.id
        : foundSubscription.user;

    const plan = await payload.find({
      collection: "plans",
      where: { stripeProductId: { equals: planId } },
      limit: 1,
    });

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

    payload.logger.info(
      `Current period start: ${currentPeriodStart} as date: ${new Date(currentPeriodStart * 1000).toISOString()}`
    );

    // Combine both updates into a single operation
    // Use skipSync to prevent beforeChange hook from calling Stripe API
    await payload.update({
      collection: "subscriptions",
      id: foundSubscription.id as number,
      data: {
        status: event.data.object.status,
        startDate: currentPeriodStart
          ? new Date(currentPeriodStart * 1000).toISOString()
          : null,
        endDate: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : null,
        ...(plan.docs[0]?.id && { plan: plan.docs[0].id }),
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
          user: { equals: subscriptionUserId },
          lesson: { equals: lessonIdNum },
        },
        limit: 1,
      });

      if (booking.totalDocs === 0) {
        await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonIdNum,
            user: subscriptionUserId,
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
    payload.logger.error(`Error updating subscription: ${error}`);
    // Re-throw critical errors
    if (error instanceof Error && error.message === "Subscription not found") {
      throw error;
    }
  }
};

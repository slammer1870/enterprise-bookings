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
  const asCollection = (s: string): any => s;

  const { customer } = event.data.object;

  const planId = event.data.object.items.data[0]?.plan?.product;

  const metadata = event.data.object.metadata ?? {};
  const lessonId =
    metadata.lessonId ?? metadata.lesson_id ?? undefined;
  const bookingIdsRaw = metadata.bookingIds ?? undefined;

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
    const stripeAccountId = (event as unknown as { account?: string | null }).account ?? null;
    const user = await findUserByCustomer(payload, customer as string, { stripeAccountId });
    const stripeCustomerId =
      typeof customer === "string" ? customer : (customer as any)?.id;

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

    const subscription = await payload.create({
      collection: asCollection("subscriptions"),
      data: {
        user: user.id as number,
        plan: plan.docs[0]?.id as number,
        status: "active",
        stripeSubscriptionId: event.data.object.id as string,
        ...(typeof stripeAccountId === "string" && stripeAccountId.trim() && typeof stripeCustomerId === "string" && stripeCustomerId.trim()
          ? { stripeAccountId: stripeAccountId.trim(), stripeCustomerId: stripeCustomerId.trim() }
          : {}),
        startDate: currentPeriodStart
          ? new Date(currentPeriodStart * 1000).toISOString()
          : null,
        endDate: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        cancelAt: event.data.object.cancel_at
          ? new Date(event.data.object.cancel_at * 1000).toISOString()
          : null,
      },
      context: { skipStripeSync: true },
    });

    const confirmBookingAndCreateTransaction = async (
      bookingId: number,
      tenantId: number | undefined
    ) => {
      const hasTransactions = await payload.find({
        collection: asCollection("transactions"),
        where: { booking: { equals: bookingId } },
        limit: 1,
      });
      if (hasTransactions.totalDocs === 0) {
        await payload.create({
          collection: asCollection("transactions"),
          data: {
            booking: bookingId,
            paymentMethod: "subscription",
            subscriptionId: subscription.id as number,
            ...(tenantId != null ? { tenant: tenantId } : {}),
          },
          overrideAccess: true,
        });
      }
    };

    if (bookingIdsRaw) {
      const ids = bookingIdsRaw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n));
      for (const id of ids) {
        try {
          const booking = (await payload.findByID({
            collection: "bookings",
            id,
            depth: 1,
          })) as { tenant?: number | { id: number }; status?: string } | null;
          if (!booking) continue;
          await payload.update({
            collection: "bookings",
            id,
            data: { status: "confirmed" },
            overrideAccess: true,
          });
          const tenantId =
            booking?.tenant != null
              ? typeof booking.tenant === "object" && "id" in booking.tenant
                ? booking.tenant.id
                : (booking.tenant as number)
              : undefined;
          await confirmBookingAndCreateTransaction(id, tenantId);
        } catch {
          payload.logger.error(`Failed to confirm booking ${id} from subscription metadata`);
        }
      }
    } else if (lessonId) {
      const lessonIdNum = Number(lessonId);
      if (isNaN(lessonIdNum)) {
        payload.logger.error(`Invalid lessonId in metadata: ${lessonId}`);
        return;
      }

      let lesson: { id: number; tenant?: number | { id: number } } | null = null;
      try {
        lesson = (await payload.findByID({
          collection: "lessons" as any,
          id: lessonIdNum,
          depth: 1,
        })) as { id: number; tenant?: number | { id: number } } | null;
      } catch {
        payload.logger.error(`Lesson not found: ${lessonIdNum}`);
        return;
      }

      const bookingQuery = await payload.find({
        collection: "bookings",
        where: {
          user: { equals: user.id as number },
          lesson: { equals: lessonIdNum },
        },
        limit: 1,
      });

      let bookingId: number;

      if (bookingQuery.totalDocs === 0) {
        const created = await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonIdNum,
            user: user.id as number,
            status: "confirmed",
          },
          overrideAccess: true, // Bypass access control for webhook
        });
        bookingId = created.id as number;
      } else {
        const existing = bookingQuery.docs[0];
        bookingId = existing?.id as number;
        await payload.update({
          collection: "bookings",
          id: bookingId,
          data: { status: "confirmed" },
          overrideAccess: true, // Bypass access control for webhook
        });
      }

      const tenantId =
        lesson?.tenant != null
          ? typeof lesson.tenant === "object" && "id" in lesson.tenant
            ? lesson.tenant.id
            : (lesson.tenant as number)
          : undefined;

      await confirmBookingAndCreateTransaction(bookingId, tenantId);
    }
  } catch (error) {
    payload.logger.error(`Error creating subscription: ${error}`);
    // Re-throw critical errors
    if (error instanceof Error && error.message === "Plan not found") {
      throw error;
    }
  }
};

/**
 * Stripe Payment Intent Succeeded webhook handler.
 * Processes successful payment intents and confirms bookings from metadata (bookingId, bookingIds, etc.).
 * Apps register it with stripePlugin({ webhooks: { 'payment_intent.succeeded': paymentIntentSucceeded } }).
 */
import type { Payload } from "payload";

export interface PaymentIntentSucceededArgs {
  event: {
    data: { object: { id?: string; customer?: string; metadata?: Record<string, string> } };
  };
  payload: Payload;
}

export const paymentIntentSucceeded = async (args: PaymentIntentSucceededArgs): Promise<void> => {
  const { event, payload } = args;
  const { metadata } = event.data.object;
  if (!metadata) return;

  try {
    if (metadata.lessonId) {
      const lessonId = parseInt(metadata.lessonId, 10);
      const userQuery = await payload.find({
        collection: "users",
        where: { stripeCustomerId: { equals: event.data.object.customer as string } },
      });
      const user = userQuery.docs[0];
      if (!user) {
        payload.logger?.error?.(`User not found - Payment Intent: ${event.data.object.id}`);
        return;
      }
      const existingBookingsQuery = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lessonId },
          user: { equals: user.id },
        },
      });
      const existingBookings = existingBookingsQuery.docs;
      if (existingBookings.length > 0) {
        await payload.update({
          collection: "bookings",
          id: existingBookings[0]?.id as number,
          data: { status: "confirmed" },
        });
      } else {
        const created = await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonId,
            status: "confirmed",
            user: user.id,
          },
        });
        payload.logger?.info?.(`Created booking ${created.id} - Payment Intent: ${event.data.object.id}`);
      }
      return;
    }

    const bookingIds: number[] = [];
    if (metadata.bookingId) {
      const id = parseInt(metadata.bookingId, 10);
      if (!isNaN(id)) bookingIds.push(id);
    }
    if (metadata.bookingIds) {
      const ids = metadata.bookingIds
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      bookingIds.push(...ids);
    }
    Object.keys(metadata).forEach((key) => {
      if (key.startsWith("booking_") && key !== "bookingIds") {
        const val = metadata[key];
        if (val) {
          const id = parseInt(val, 10);
          if (!isNaN(id)) bookingIds.push(id);
        }
      }
    });

    if (bookingIds.length === 0) {
      payload.logger?.info?.(`Payment intent succeeded but no booking IDs in metadata - ${event.data.object.id}`);
      return;
    }

    await Promise.all(
      bookingIds.map(async (bookingId) => {
        try {
          const existing = await payload.findByID({ collection: "bookings", id: bookingId });
          if (!existing) {
            payload.logger?.warn?.(`Booking ${bookingId} not found`);
            return;
          }
          await payload.update({
            collection: "bookings",
            id: bookingId,
            data: { status: "confirmed" },
          });
        } catch (err) {
          payload.logger?.error?.(`Error updating booking ${bookingId}: ${err}`);
        }
      })
    );
  } catch (error) {
    payload.logger?.error?.(
      `Error processing payment_intent.succeeded (${event.data.object.id}): ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Stripe Payment Intent Succeeded Webhook Handler
 *
 * This webhook handler processes successful payment intents and automatically
 * confirms bookings based on booking IDs stored in the payment intent metadata.
 *
 * Usage in payload.config.ts:
 * ```typescript
 * import { paymentIntentSucceeded } from "@repo/payments";
 *
 * export default buildConfig({
 *   // ... other config
 *   plugins: [
 *     stripePlugin({
 *       stripeSecretKey: process.env.STRIPE_SECRET_KEY as string,
 *       stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOK_SECRET,
 *       webhooks: {
 *         "payment_intent.succeeded": paymentIntentSucceeded,
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * Metadata Format:
 * The payment intent metadata should contain booking IDs in one of these formats:
 *
 * 1. Single booking: { bookingId: "123" }
 * 2. Multiple bookings: { bookingIds: "123,456,789" }
 * 3. Individual entries: { booking_1: "123", booking_2: "456" }
 *
 * When creating a payment intent:
 * ```typescript
 * const paymentIntent = await stripe.paymentIntents.create({
 *   amount: 2000,
 *   currency: "eur",
 *   metadata: {
 *     bookingIds: "123,456,789", // Booking IDs to confirm
 *   },
 * });
 * ```
 */

import Stripe from "stripe";
import { Payload } from "payload";

interface PaymentIntentSucceededArgs {
  event: {
    data: {
      object: Stripe.PaymentIntent;
    };
  };
  payload: Payload;
}

export const paymentIntentSucceeded = async (
  args: PaymentIntentSucceededArgs
) => {
  const { event, payload } = args;

  const { metadata } = event.data.object;

  try {
    // Extract booking IDs from metadata
    // Metadata can contain booking IDs in various formats:
    // - Single booking: { bookingId: "123" }
    // - Multiple bookings: { bookingIds: "123,456,789" }
    // - Individual booking entries: { booking_1: "123", booking_2: "456" }

    if (metadata.lessonId) {
      const lessonId = parseInt(metadata.lessonId);
      const quantity = Math.max(1, parseInt(metadata.quantity ?? "1", 10) || 1);

      const userQuery = await payload.find({
        collection: "users",
        where: {
          stripeCustomerId: { equals: event.data.object.customer },
        },
      });

      const user = userQuery.docs[0];

      if (!user) {
        payload.logger.error(
          `User not found - Payment Intent: ${event.data.object.id}, Customer: ${event.data.object.customer}`
        );
        return;
      }

      const lesson = await payload.findByID({
        collection: "lessons",
        id: lessonId,
        depth: 1,
      }).catch(() => null);
      const remainingCapacity =
        lesson && typeof (lesson as unknown as { remainingCapacity?: number }).remainingCapacity === "number"
          ? Math.max(0, (lesson as unknown as { remainingCapacity: number }).remainingCapacity)
          : 0;

      const existingBookingsQuery = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lessonId },
          user: { equals: user.id },
        },
      });

      const existingBookings = existingBookingsQuery.docs as { id: number; status?: string }[];
      const confirmed = existingBookings.filter((b) => b.status === "confirmed");
      const pending = existingBookings.filter((b) => b.status !== "confirmed");
      const needToConfirm = Math.max(0, quantity - confirmed.length);
      const toConfirm = pending.slice(0, needToConfirm);
      const toCreate = needToConfirm - toConfirm.length;
      const maxCanAdd = remainingCapacity;
      const toConfirmCapped = toConfirm.slice(0, maxCanAdd);
      const createCapped = Math.max(0, Math.min(toCreate, maxCanAdd - toConfirmCapped.length));

      for (const b of toConfirmCapped) {
        await payload.update({
          collection: "bookings",
          id: b.id,
          data: { status: "confirmed" },
        });
      }
      for (let i = 0; i < createCapped; i++) {
        const createBooking = await payload.create({
          collection: "bookings",
          data: {
            lesson: lessonId,
            status: "confirmed",
            user: user.id,
          },
        });
        payload.logger.info(
          `Created booking ${createBooking.id} - Payment Intent: ${event.data.object.id}, Lesson: ${lessonId}`
        );
      }
      if (createCapped < toCreate || toConfirmCapped.length < toConfirm.length) {
        payload.logger.warn(
          `Payment intent ${event.data.object.id}: capped bookings to avoid overbooking (remainingCapacity: ${remainingCapacity})`
        );
      }
      return;
    }

    const bookingIds: number[] = [];

    // Check for single booking ID
    if (metadata.bookingId) {
      const id = parseInt(metadata.bookingId);
      if (!isNaN(id)) {
        bookingIds.push(id);
      }
    }

    // Check for comma-separated booking IDs
    if (metadata.bookingIds) {
      const ids = metadata.bookingIds
        .split(",")
        .map((id: string) => parseInt(id.trim()))
        .filter((id: number) => !isNaN(id));
      bookingIds.push(...ids);
    }

    // Check for individual booking entries (booking_1, booking_2, etc.)
    Object.keys(metadata).forEach((key) => {
      if (key.startsWith("booking_") && key !== "bookingIds") {
        const value = metadata[key];
        if (value) {
          const id = parseInt(value);
          if (!isNaN(id)) {
            bookingIds.push(id);
          }
        }
      }
    });

    if (bookingIds.length === 0) {
      payload.logger.info(
        `Payment intent succeeded but no booking IDs found in metadata - Payment Intent: ${event.data.object.id}, Metadata: ${JSON.stringify(metadata)}`
      );
      return;
    }

    payload.logger.info(
      `Processing payment intent succeeded for ${bookingIds.length} booking(s) - Payment Intent: ${event.data.object.id}, Booking IDs: ${bookingIds.join(', ')}`
    );

    // Update each booking to confirmed status
    const updatePromises = bookingIds.map(async (bookingId) => {
      try {
        // First, check if the booking exists
        const existingBooking = await payload.findByID({
          collection: "bookings",
          id: bookingId,
        });

        if (!existingBooking) {
          payload.logger.warn(
            `Booking with ID ${bookingId} not found (Payment Intent: ${event.data.object.id})`
          );
          return;
        }

        // Update the booking status to confirmed
        await payload.update({
          collection: "bookings",
          id: bookingId,
          data: {
            status: "confirmed",
          },
        });

        payload.logger.info(
          `Successfully confirmed booking ${bookingId} (Payment Intent: ${event.data.object.id})`
        );
      } catch (error) {
        payload.logger.error(
          `Error updating booking ${bookingId} (Payment Intent: ${event.data.object.id}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    payload.logger.info(
      `Payment intent processing completed (Payment Intent: ${event.data.object.id}, Total Bookings: ${bookingIds.length})`
    );
  } catch (error) {
    payload.logger.error(
      `Error processing payment intent succeeded webhook (Payment Intent: ${event.data.object.id}): ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

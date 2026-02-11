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
    // When we have specific booking IDs (from reserve-at-checkout), confirm those first. Otherwise fall back to lessonId+quantity.
    const explicitBookingIds: number[] = [];
    if (metadata.bookingId) {
      const id = parseInt(metadata.bookingId, 10);
      if (!isNaN(id)) explicitBookingIds.push(id);
    }
    if (metadata.bookingIds) {
      const ids = metadata.bookingIds
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      explicitBookingIds.push(...ids);
    }
    Object.keys(metadata).forEach((key) => {
      if (key.startsWith("booking_") && key !== "bookingIds") {
        const val = metadata[key];
        if (val) {
          const id = parseInt(val, 10);
          if (!isNaN(id)) explicitBookingIds.push(id);
        }
      }
    });

    if (explicitBookingIds.length > 0) {
      await Promise.all(
        explicitBookingIds.map(async (bookingId) => {
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
      return;
    }

    if (metadata.lessonId) {
      const lessonId = parseInt(metadata.lessonId, 10);
      const quantity = Math.max(1, parseInt(metadata.quantity ?? "1", 10) || 1);
      const userQuery = await payload.find({
        collection: "users",
        where: { stripeCustomerId: { equals: event.data.object.customer as string } },
      });
      const user = userQuery.docs[0];
      if (!user) {
        payload.logger?.error?.(`User not found - Payment Intent: ${event.data.object.id}`);
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
      let toCreate = needToConfirm - toConfirm.length;
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
      if (createCapped < toCreate || toConfirmCapped.length < toConfirm.length) {
        payload.logger?.warn?.(`Payment intent ${event.data.object.id}: capped bookings to avoid overbooking (remainingCapacity: ${remainingCapacity})`);
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

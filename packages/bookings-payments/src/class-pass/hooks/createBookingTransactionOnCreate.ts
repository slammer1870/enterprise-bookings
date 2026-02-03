import type { CollectionAfterChangeHook } from "payload";

type BookingDoc = {
  id?: number;
  paymentMethodUsed?: string;
  classPassIdUsed?: number;
  subscriptionIdUsed?: number;
  tenant?: number | { id: number };
};

/**
 * Returns an afterChange hook for the bookings collection that creates a
 * booking-transaction when a booking is created with:
 * - paymentMethodUsed 'class_pass' and classPassIdUsed, or
 * - paymentMethodUsed 'subscription' and subscriptionIdUsed.
 * Apps must add those fields to the booking (e.g. via overrides).
 */
export function createBookingTransactionOnCreate(): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return;
    const d = doc as BookingDoc;
    if (d.id == null) return;

    const tenantId =
      typeof d.tenant === "object" && d.tenant != null ? d.tenant.id : d.tenant;

    const isClassPass = d.paymentMethodUsed === "class_pass" && d.classPassIdUsed != null;
    const isSubscription = d.paymentMethodUsed === "subscription" && d.subscriptionIdUsed != null;

    if (!isClassPass && !isSubscription) return;

    const bookingId = d.id;
    const payload = req.payload;

    const txData: Record<string, unknown> = {
      booking: bookingId,
      ...(tenantId ? { tenant: tenantId } : {}),
    };

    if (isClassPass) {
      txData.paymentMethod = "class_pass";
      txData.classPassId = d.classPassIdUsed;
    } else {
      txData.paymentMethod = "subscription";
      txData.subscriptionId = d.subscriptionIdUsed;
    }

    setImmediate(async () => {
      try {
        const r = req as { context?: Record<string, unknown> };
        if (r.context == null || typeof r.context !== "object") r.context = {};
        if (tenantId != null) r.context.tenant = tenantId;
        r.context.skipBookingValidationForId = bookingId;

        await payload.create({
          collection: "transactions" as import("payload").CollectionSlug,
          data: txData,
          overrideAccess: true,
          req: r as Parameters<typeof payload.create>[0]["req"],
        });
      } catch (err) {
        payload.logger?.error?.(
          `createBookingTransactionOnCreate: failed to create booking-transaction for booking ${bookingId}: ${err}`,
        );
      }
    });
  };
}

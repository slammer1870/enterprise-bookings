import type { CollectionAfterChangeHook } from "payload";

/**
 * Returns an afterChange hook for the bookings collection that creates a
 * booking-transaction when a booking is created with paymentMethodUsed 'class_pass'
 * and classPassIdUsed set. Apps must add those fields to the booking (e.g. via overrides).
 */
export function createBookingTransactionOnCreate(): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== "create") return;
    const d = doc as {
      id?: number;
      paymentMethodUsed?: string;
      classPassIdUsed?: number;
      tenant?: number | { id: number };
    };
    if (d.paymentMethodUsed !== "class_pass" || d.classPassIdUsed == null || d.id == null)
      return;

    const tenantId =
      typeof d.tenant === "object" && d.tenant != null ? d.tenant.id : d.tenant;

    // Defer create until after the booking's transaction commits; otherwise the DB
    // rejects the insert (booking_id FK) because the booking row is not yet visible.
    const bookingId = d.id;
    const classPassIdUsed = d.classPassIdUsed;
    const payload = req.payload;
    setImmediate(async () => {
      try {
        const r = req as { context?: Record<string, unknown> };
        if (r.context == null || typeof r.context !== "object") r.context = {};
        if (tenantId != null) r.context.tenant = tenantId;
        r.context.skipBookingValidationForId = bookingId;

        await payload.create({
          collection: "booking-transactions" as import("payload").CollectionSlug,
          data: {
            booking: bookingId,
            paymentMethod: "class_pass",
            classPassId: classPassIdUsed,
            ...(tenantId ? { tenant: tenantId } : {}),
          } as Record<string, unknown>,
          overrideAccess: true,
        });
      } catch (err) {
        payload.logger?.error?.(
          `createBookingTransactionOnCreate: failed to create booking-transaction for booking ${bookingId}: ${err}`,
        );
      }
    });
  };
}

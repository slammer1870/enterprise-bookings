import type { DecrementClassPassHookOptions } from "../hooks/decrementClassPassOnBookingConfirmed";

/**
 * Returns a getClassPassIdToDecrement implementation that looks up the
 * booking-transaction for this booking and returns classPassId when paymentMethod is 'class_pass'.
 * Use with createDecrementClassPassHook.
 */
export function getClassPassIdFromBookingTransaction(): DecrementClassPassHookOptions["getClassPassIdToDecrement"] {
  return async ({ doc, req }) => {
    const txResult = await req.payload.find({
      collection: "booking-transactions" as import("payload").CollectionSlug,
      where: {
        booking: { equals: doc.id },
        paymentMethod: { equals: "class_pass" },
      },
      limit: 1,
      depth: 0,
    });
    const tx = txResult.docs[0] as { classPassId?: number } | undefined;
    return tx?.classPassId ?? null;
  };
}

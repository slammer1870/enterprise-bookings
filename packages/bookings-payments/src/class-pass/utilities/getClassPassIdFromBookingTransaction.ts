import type { DecrementClassPassHookOptions } from "../hooks/decrementClassPassOnBookingConfirmed";

/**
 * Returns a getClassPassIdToDecrement implementation that looks up the
 * transaction for this booking and returns classPassId when paymentMethod is 'class_pass'.
 * Use with createDecrementClassPassHook.
 */
export function getClassPassIdFromBookingTransaction(): DecrementClassPassHookOptions["getClassPassIdToDecrement"] {
  return async ({ doc, req }) => {
    try {
      const txResult = await req.payload.find({
        collection: "transactions" as import("payload").CollectionSlug,
        where: {
          booking: { equals: doc.id },
          paymentMethod: { equals: "class_pass" },
        },
        limit: 1,
        depth: 0,
        // This is running inside a Payload afterChange hook; avoid failing the
        // request due to transactions access control mismatches.
        overrideAccess: true,
      });

      const tx = txResult.docs[0] as { classPassId?: number } | undefined;
      return tx?.classPassId ?? null;
    } catch {
      // Defensive: if transactions lookup fails (e.g. access issues),
      // skip decrement rather than crash the whole booking flow.
      return null;
    }
  };
}

import type { CollectionAfterChangeHook } from "payload";

export type DecrementClassPassHookOptions = {
  /**
   * Resolve which class-pass id to decrement from the booking/transaction context.
   * Return the class-pass document id to decrement, or null to skip.
   * Typically: look up booking-transactions where booking=doc.id and paymentMethod='class_pass', return classPassId.
   */
  getClassPassIdToDecrement: (args: {
    doc: {
      id: number;
      lesson?: number | { id: number };
      user?: number | { id: number };
      status?: string;
    };
    previousDoc: { status?: string } | null;
    req: { payload: import("payload").Payload };
  }) => Promise<number | null>;
};

/**
 * Returns an afterChange hook for the bookings collection that decrements
 * class pass quantity when a booking moves to status "confirmed", and
 * sets pass status to "used" when quantity reaches 0.
 * Uses getClassPassIdToDecrement (e.g. from booking-transactions) so we only decrement when a transaction says class_pass was used.
 */
export function createDecrementClassPassHook(
  options: DecrementClassPassHookOptions
): CollectionAfterChangeHook {
  const { getClassPassIdToDecrement } = options;
  return async ({ doc, previousDoc, req, context }) => {
    if (context?.triggerAfterChange === false) return;
    if (previousDoc?.status === "confirmed") return;
    if (doc.status !== "confirmed") return;

    const passId = await getClassPassIdToDecrement({
      doc: doc as {
        id: number;
        lesson?: number | { id: number };
        user?: number | { id: number };
        status?: string;
      },
      previousDoc,
      req,
    });
    if (passId == null) return;

    const pass = (await req.payload.findByID({
      collection: "class-passes" as import("payload").CollectionSlug,
      id: passId,
      depth: 0,
    })) as { quantity?: number; status?: string } | null;
    if (!pass || typeof pass.quantity !== "number") return;

    const nextQty = Math.max(0, pass.quantity - 1);
    const status = nextQty === 0 ? "used" : (pass.status ?? "active");
    await req.payload.update({
      collection: "class-passes" as import("payload").CollectionSlug,
      id: passId,
      data: { quantity: nextQty, status } as Record<string, unknown>,
      overrideAccess: true,
    });
  };
}

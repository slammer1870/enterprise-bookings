import type { CollectionAfterChangeHook } from "payload";
import {
  adjustClassPassForEventType,
  eventTypeIdForTimeslot,
} from "../utilities/adjust-class-pass-credits";

export type DecrementClassPassHookOptions = {
  /**
   * Resolve which class-pass id to decrement from the booking/transaction context.
   * Return the class-pass document id to decrement, or null to skip.
   * Typically: look up transactions where booking=doc.id and paymentMethod='class_pass', return classPassId.
   */
  getClassPassIdToDecrement: (_args: {
    doc: {
      id: number;
      timeslot?: number | { id: number };
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
 * Uses getClassPassIdToDecrement (e.g. from transactions) so we only decrement when a transaction says class_pass was used.
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
        timeslot?: number | { id: number };
        user?: number | { id: number };
        status?: string;
      },
      previousDoc,
      req,
    });
    if (passId == null) return;

    const eventTypeId = await eventTypeIdForTimeslot(
      req.payload,
      (doc as { timeslot?: unknown }).timeslot,
      req,
    );
    await adjustClassPassForEventType({
      payload: req.payload,
      passId,
      eventTypeId,
      delta: -1,
      req,
    });
  };
}

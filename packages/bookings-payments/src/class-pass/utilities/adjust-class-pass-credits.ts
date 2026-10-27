import type { CollectionSlug, Payload, PayloadRequest } from "payload";
import { adjustClassPassCredits, relationId } from "@repo/shared-services";

type PassDoc = {
  quantity?: number;
  status?: string | null;
  eventTypeOverrides?: Array<{
    id?: string | null;
    eventType?: unknown;
    eventTypes?: unknown;
    quantity?: number | null;
  }> | null;
};

/**
 * Spend (negative delta) or restore (positive delta) the bucket for this event type.
 */
export async function adjustClassPassForEventType(args: {
  payload: Payload;
  passId: number;
  eventTypeId: number | null;
  delta: number;
  req?: PayloadRequest;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const pass = (await args.payload.findByID({
    collection: "class-passes" as CollectionSlug,
    id: args.passId,
    depth: 0,
    overrideAccess: true,
    req: args.req,
  })) as PassDoc | null;
  if (!pass || typeof pass.quantity !== "number") {
    return { ok: false, error: "Class pass not found." };
  }

  const adjusted = adjustClassPassCredits(pass, args.eventTypeId, args.delta);
  if (!adjusted.ok) return adjusted;

  await args.payload.update({
    collection: "class-passes" as CollectionSlug,
    id: args.passId,
    data: {
      quantity: adjusted.pass.quantity,
      status: adjusted.pass.status,
      eventTypeOverrides: adjusted.pass.eventTypeOverrides.map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        eventTypes: row.eventTypes,
        quantity: row.quantity,
      })),
    } as Record<string, unknown>,
    overrideAccess: true,
    req: args.req,
  });
  return { ok: true };
}

export async function eventTypeIdForTimeslot(
  payload: Payload,
  timeslot: unknown,
  req?: PayloadRequest,
): Promise<number | null> {
  if (timeslot != null && typeof timeslot === "object" && "eventType" in timeslot) {
    const fromPopulated = relationId((timeslot as { eventType?: unknown }).eventType);
    if (fromPopulated != null) return fromPopulated;
  }
  const timeslotId = relationId(timeslot);
  if (timeslotId == null) return null;
  const doc = (await payload.findByID({
    collection: "timeslots" as CollectionSlug,
    id: timeslotId,
    depth: 0,
    overrideAccess: true,
    req,
  })) as { eventType?: unknown } | null;
  return relationId(doc?.eventType);
}

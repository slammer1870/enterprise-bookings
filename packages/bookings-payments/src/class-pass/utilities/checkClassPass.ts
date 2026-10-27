/**
 * Check if the user has a valid class pass for the given tenant and event type.
 * A pass type can pay for an event type when that event type is in allowedEventTypes.
 */
import type { Payload } from "payload";
import {
  creditsRemainingForEventType,
  findClassPassTypesForEventType,
  relationId,
} from "@repo/shared-services";
import type {
  ClassPassLike,
  EventTypeLike,
  UserLike,
  TenantLike,
} from "../../types";

export type CheckClassPassArgs = {
  payload: Payload;
  user: UserLike;
  tenant: TenantLike;
  eventType: EventTypeLike;
};

export type CheckClassPassResult =
  | { valid: true; pass: ClassPassLike }
  | { valid: false; error: string };

export async function checkClassPass({
  payload,
  user,
  tenant,
  eventType,
}: CheckClassPassArgs): Promise<CheckClassPassResult> {
  const eventTypeId = relationId(eventType?.id);
  if (eventTypeId == null) {
    return { valid: false, error: "Class passes not allowed for this event type" };
  }

  const tenantId = relationId(tenant);
  const userId = relationId(user);
  if (tenantId == null || userId == null) {
    return { valid: false, error: "Missing tenant or user" };
  }

  const types = await findClassPassTypesForEventType(payload, eventTypeId, {
    tenantId,
    depth: 0,
  });
  const allowedTypeIds = types
    .map((doc) => relationId(doc.id))
    .filter((id): id is number => id != null);
  if (allowedTypeIds.length === 0) {
    return { valid: false, error: "Class passes not allowed for this event type" };
  }

  const now = new Date().toISOString();
  const result = await payload.find({
    collection: "class-passes" as import("payload").CollectionSlug,
    where: {
      user: { equals: userId },
      tenant: { equals: tenantId },
      status: { equals: "active" },
      expirationDate: { greater_than: now },
      type: { in: allowedTypeIds },
    },
    limit: 20,
    sort: "expirationDate",
    depth: 0,
    overrideAccess: true,
  });

  const pass = result.docs.find(
    (doc) =>
      creditsRemainingForEventType(
        doc as { quantity?: unknown; eventTypeOverrides?: never },
        eventTypeId,
      ) > 0,
  );
  if (!pass) {
    return { valid: false, error: "No valid class pass found for this event type" };
  }

  return { valid: true, pass: pass as ClassPassLike };
}

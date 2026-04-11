/**
 * Check if the user has a valid class pass for the given tenant and event type.
 * Event types restrict which pass types (allowedClassPasses) are accepted;
 * the user must have a pass whose type is in that list.
 */
import type { Payload } from "payload";
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

function toIdArray(val: unknown): number[] {
  if (Array.isArray(val)) {
    return val
      .map((v) => (typeof v === "object" && v != null && "id" in v ? (v as { id: number }).id : v))
      .filter((v): v is number => typeof v === "number");
  }
  return [];
}

export async function checkClassPass({
  payload,
  user,
  tenant,
  eventType,
}: CheckClassPassArgs): Promise<CheckClassPassResult> {
  const allowed = eventType?.paymentMethods?.allowedClassPasses;
  const allowedTypeIds = toIdArray(allowed);
  if (allowedTypeIds.length === 0) {
    return { valid: false, error: "Class passes not allowed for this event type" };
  }

  const tenantId =
    typeof tenant === "object" && tenant !== null ? tenant.id : tenant;
  const userId = typeof user === "object" && user !== null ? user.id : user;
  if (tenantId == null || userId == null) {
    return { valid: false, error: "Missing tenant or user" };
  }

  const now = new Date().toISOString();
  const tenantFilter =
    tenantId != null
      ? { tenant: { equals: tenantId } }
      : ({} as Record<string, unknown>);
  const result = await payload.find({
    collection: "class-passes" as import("payload").CollectionSlug,
    where: {
      user: { equals: userId },
      ...tenantFilter,
      status: { equals: "active" },
      quantity: { greater_than: 0 },
      expirationDate: { greater_than: now },
      type: { in: allowedTypeIds },
    },
    limit: 1,
    sort: "expirationDate",
    depth: 0,
  });

  if (!result.docs.length) {
    return { valid: false, error: "No valid class pass found for this event type" };
  }

  return { valid: true, pass: result.docs[0] as ClassPassLike };
}

import type { CollectionSlug, Payload, Where } from "payload";
import { relationId, relationIds } from "./event-type-allowance";

type FindResult = { docs?: unknown[] };

function asPayload(payload: Payload): Payload & {
  find: (_args: unknown) => Promise<FindResult>;
} {
  return payload as Payload & { find: (_args: unknown) => Promise<FindResult> };
}

async function findCollection(
  payload: Payload,
  collection: string,
  where: Where,
  depth: number,
): Promise<unknown[]> {
  if (!payload?.collections || !(collection in payload.collections)) return [];
  try {
    const result = await asPayload(payload).find({
      collection: collection as CollectionSlug,
      where,
      depth,
      limit: 200,
      overrideAccess: true,
    });
    return Array.isArray(result?.docs) ? result.docs : [];
  } catch {
    return [];
  }
}

export async function findPlansForEventType(
  payload: Payload,
  eventTypeId: number | null,
  opts?: { tenantId?: number | null; depth?: number },
): Promise<Array<{ id: number } & Record<string, unknown>>> {
  if (eventTypeId == null) return [];
  const where: Where = { allowedEventTypes: { contains: eventTypeId } };
  if (opts?.tenantId != null) where.tenant = { equals: opts.tenantId };
  const docs = await findCollection(payload, "plans", where, opts?.depth ?? 1);
  return docs.filter((doc) => relationId((doc as { id?: unknown }).id) != null) as Array<
    { id: number } & Record<string, unknown>
  >;
}

export async function findClassPassTypesForEventType(
  payload: Payload,
  eventTypeId: number | null,
  opts?: { tenantId?: number | null; depth?: number },
): Promise<Array<{ id: number } & Record<string, unknown>>> {
  if (eventTypeId == null) return [];
  const where: Where = { allowedEventTypes: { contains: eventTypeId } };
  if (opts?.tenantId != null) where.tenant = { equals: opts.tenantId };
  const docs = await findCollection(
    payload,
    "class-pass-types",
    where,
    opts?.depth ?? 0,
  );
  return docs.filter((doc) => relationId((doc as { id?: unknown }).id) != null) as Array<
    { id: number } & Record<string, unknown>
  >;
}

export async function attachProductAllowLists(
  payload: Payload,
  eventType: { id?: unknown; paymentMethods?: Record<string, unknown> | null } | null | undefined,
  opts?: { tenantId?: number | null },
): Promise<void> {
  if (!eventType || typeof eventType !== "object") return;
  const eventTypeId = relationId(eventType.id);
  if (eventTypeId == null) return;
  const [plans, classPassTypes] = await Promise.all([
    findPlansForEventType(payload, eventTypeId, opts),
    findClassPassTypesForEventType(payload, eventTypeId, opts),
  ]);
  const paymentMethods = {
    ...(eventType.paymentMethods ?? {}),
    allowedPlans: plans,
    allowedClassPasses: classPassTypes,
  };
  eventType.paymentMethods = paymentMethods;
}

/**
 * Batch version for schedule lists. Groups products by the event types they allow.
 */
export async function allowListsByEventTypeId(
  payload: Payload,
  eventTypeIds: number[],
  opts?: { tenantId?: number | null },
): Promise<
  Map<number, { plans: unknown[]; classPassTypes: unknown[] }>
> {
  const map = new Map<number, { plans: unknown[]; classPassTypes: unknown[] }>();
  for (const id of eventTypeIds) {
    map.set(id, { plans: [], classPassTypes: [] });
  }
  if (eventTypeIds.length === 0) return map;

  const where: Where =
    opts?.tenantId != null
      ? {
          and: [
            { allowedEventTypes: { in: eventTypeIds } },
            { tenant: { equals: opts.tenantId } },
          ],
        }
      : { allowedEventTypes: { in: eventTypeIds } };
  const [plans, classPassTypes] = await Promise.all([
    findCollection(payload, "plans", where, 0),
    findCollection(payload, "class-pass-types", where, 0),
  ]);

  const add = (docs: unknown[], key: "plans" | "classPassTypes") => {
    for (const doc of docs) {
      const allowed = relationIds((doc as { allowedEventTypes?: unknown }).allowedEventTypes);
      for (const id of allowed) {
        const bucket = map.get(id);
        if (!bucket) continue;
        bucket[key].push(doc);
      }
    }
  };
  add(plans, "plans");
  add(classPassTypes, "classPassTypes");
  return map;
}

import type { CollectionSlug, Field, RelationshipField } from "payload";
import { BasePayload, PayloadRequest } from "payload";

import { getTimeslotsQuery } from "@repo/shared-utils";
import { Timeslot } from "@repo/shared-types";

import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";
import { getTimeslotStartTimeFilter, normalizeTimeslotSearchParams } from "../utils/timeslot-search-params";

function resolveBookingsCollectionSlug(
  payload: BasePayload,
  timeslotsSlug: string,
): string {
  const collections = payload.config.collections ?? [];
  for (const col of collections) {
    if (!col?.fields || col.slug === timeslotsSlug) continue;
    for (const field of col.fields as Field[]) {
      if (field.type !== "relationship" || field.name !== "timeslot") continue;
      const rel = (field as RelationshipField).relationTo;
      const targets = (Array.isArray(rel) ? rel : [rel]) as string[];
      if (targets.includes(timeslotsSlug)) {
        return col.slug;
      }
    }
  }
  return DEFAULT_BOOKING_COLLECTION_SLUGS.bookings;
}

function resolveRelatedCollectionSlug(
  payload: BasePayload,
  timeslotsSlug: string,
  fieldName: "tenant" | "eventType",
): string {
  const col = payload.config.collections?.find((c) => c.slug === timeslotsSlug);
  for (const field of (col?.fields ?? []) as Field[]) {
    if (field.type !== "relationship" || field.name !== fieldName) continue;
    const rel = (field as RelationshipField).relationTo;
    const targets = (Array.isArray(rel) ? rel : [rel]) as string[];
    const first = targets[0];
    if (typeof first === "string" && first.length > 0) return first;
  }
  return fieldName === "tenant" ? "tenants" : "event-types";
}

type TenantListStub = { id: number; slug?: string; timeZone?: string | null };
type EventTypeListStub = { id: number; name: string };

/**
 * With `depth: 0`, relationships are ids only. Re-hydrate the small shapes the admin list needs
 * in two batched finds (avoids Payload expanding nested paymentMethods, join bookings, etc.).
 */
async function attachShallowTenantAndEventType(
  payload: BasePayload,
  timeslots: Timeslot[],
  timeslotsSlug: string,
  req?: PayloadRequest,
): Promise<void> {
  if (timeslots.length === 0) return;

  const tenantsSlug = resolveRelatedCollectionSlug(payload, timeslotsSlug, "tenant");
  const eventTypesSlug = resolveRelatedCollectionSlug(payload, timeslotsSlug, "eventType");

  const tenantIds = new Set<number>();
  const eventTypeIds = new Set<number>();

  for (const t of timeslots) {
    const tr = t.tenant;
    if (typeof tr === "number" && Number.isFinite(tr)) tenantIds.add(tr);
    else if (tr && typeof tr === "object" && "id" in tr) {
      const id = (tr as { id: unknown }).id;
      if (typeof id === "number" && Number.isFinite(id)) tenantIds.add(id);
    }

    const er = t.eventType as unknown;
    if (typeof er === "number" && Number.isFinite(er)) eventTypeIds.add(er);
    else if (er && typeof er === "object" && "id" in er) {
      const id = (er as { id: unknown }).id;
      if (typeof id === "number" && Number.isFinite(id)) eventTypeIds.add(id);
    }
  }

  const tenantById = new Map<number, TenantListStub>();
  const eventTypeById = new Map<number, EventTypeListStub>();
  const chunkSize = 150;
  const access = req ? { req, overrideAccess: false } : { overrideAccess: true };

  const tenantIdList = [...tenantIds];
  for (let i = 0; i < tenantIdList.length; i += chunkSize) {
    const slice = tenantIdList.slice(i, i + chunkSize);
    const batch = await payload.find({
      collection: tenantsSlug,
      where: { id: { in: slice } },
      depth: 0,
      limit: slice.length,
      select: { id: true, slug: true, timeZone: true } as any,
      ...(access as object),
    } as Parameters<BasePayload["find"]>[0]);
    for (const doc of batch.docs as TenantListStub[]) {
      tenantById.set(doc.id, {
        id: doc.id,
        slug: doc.slug,
        timeZone: doc.timeZone ?? null,
      });
    }
  }

  const eventTypeIdList = [...eventTypeIds];
  for (let i = 0; i < eventTypeIdList.length; i += chunkSize) {
    const slice = eventTypeIdList.slice(i, i + chunkSize);
    const batch = await payload.find({
      collection: eventTypesSlug,
      where: { id: { in: slice } },
      depth: 0,
      limit: slice.length,
      select: { id: true, name: true } as any,
      ...(access as object),
    } as Parameters<BasePayload["find"]>[0]);
    for (const doc of batch.docs as EventTypeListStub[]) {
      eventTypeById.set(doc.id, { id: doc.id, name: doc.name });
    }
  }

  for (const t of timeslots) {
    const tid =
      typeof t.tenant === "number"
        ? t.tenant
        : t.tenant && typeof t.tenant === "object"
          ? (t.tenant as { id: number }).id
          : null;
    if (tid != null) {
      const stub = tenantById.get(tid);
      if (stub) (t as Timeslot).tenant = stub;
    }

    const eid =
      typeof t.eventType === "number"
        ? t.eventType
        : t.eventType && typeof t.eventType === "object"
          ? (t.eventType as { id: number }).id
          : null;
    if (eid != null) {
      const stub = eventTypeById.get(eid);
      if (stub) (t as Timeslot).eventType = stub as Timeslot["eventType"];
    }
  }
}

/**
 * Populate `bookings.totalDocs` without using the timeslot join field (which resolves
 * per-document in Payload and can mean hundreds of queries for a single day view).
 *
 * Uses `payload.count` per timeslot (indexed `timeslot` equality) instead of paginating
 * through every booking row — the old approach could take 10s+ when many bookings exist.
 */
async function attachBookingCountsForTimeslots(
  payload: BasePayload,
  timeslots: Timeslot[],
  timeslotsSlug: string,
  req?: PayloadRequest,
): Promise<void> {
  const ids = timeslots
    .map((t) => t.id)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  if (ids.length === 0) return;

  const bookingsSlug = resolveBookingsCollectionSlug(payload, timeslotsSlug);
  const access = req ? { req, overrideAccess: false } : { overrideAccess: true };

  /** Bounded parallelism so we do not open dozens of DB calls at once. */
  const concurrency = 12;
  const countByTimeslot = new Map<number, number>();

  for (let i = 0; i < ids.length; i += concurrency) {
    const slice = ids.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (timeslotId) => {
        const { totalDocs } = await payload.count({
          collection: bookingsSlug as CollectionSlug,
          where: { timeslot: { equals: timeslotId } },
          ...(access as object),
        });
        return [timeslotId, totalDocs] as const;
      }),
    );
    for (const [timeslotId, totalDocs] of results) {
      countByTimeslot.set(timeslotId, totalDocs);
    }
  }

  for (const t of timeslots) {
    const total = typeof t.id === "number" ? (countByTimeslot.get(t.id) ?? 0) : 0;
    (t as Timeslot).bookings = { docs: [], totalDocs: total } as Timeslot["bookings"];
  }
}

export const getTimeslots = async (
  payload: BasePayload,
  searchParams: { [key: string]: string | string[] | undefined },
  params: any,
  req?: PayloadRequest
) => {
  const startTimeFilter = getTimeslotStartTimeFilter(searchParams);
  const effectiveSearchParams = startTimeFilter
    ? searchParams
    : getTimeslotsQuery(new Date(), undefined, { depth: 0 }).replace(/^\?/, "");
  const ps = normalizeTimeslotSearchParams(effectiveSearchParams);
  // Admin list: depth 0 so relationships/joins are not expanded (Payload can still
  // hydrate heavy graphs at depth 1+ despite `select`). Tenant + event type names
  // are attached in one batched pass each; booking counts in attachBookingCountsForTimeslots.
  ps.depth = 0;

  // segments: ['admin', 'collections', 'timeslots'] -> use 'timeslots'
  const collection =
    (params?.segments && params.segments[params.segments.length - 1]) || "timeslots";
  const searchQuery = { collection, ...ps } as Record<string, unknown>;

  // When req.context.tenant is set, explicitly filter by tenant (multi-tenant plugin may not apply it for this find)
  const tenantId = req?.context?.tenant
    ? typeof (req.context.tenant as unknown) === "object" && (req.context.tenant as any)?.id != null
      ? (req.context.tenant as any).id
      : (req.context.tenant as number | string)
    : undefined;
  if (tenantId != null) {
    const baseWhere = (searchQuery.where as object) ?? {};
    searchQuery.where = { and: [baseWhere, { tenant: { equals: tenantId } }] };
  }

  // Pass req to payload.find() so multi-tenant plugin can filter by tenant
  // If req is provided, it will include user context and tenant filtering will be applied
  // IMPORTANT: Set overrideAccess: false when req is provided to enforce access control
  // This ensures tenant filtering and user permissions are respected
  const timeslotList = await payload.find({
    collection,
    ...ps,
    ...(tenantId != null ? { where: searchQuery.where } : {}),
    ...(req ? { req, overrideAccess: false } : {}),
    // Only select fields needed for the admin list UI.
    // This avoids executing expensive virtual fields like:
    // - `remainingCapacity` (afterRead hook queries bookings)
    // - `bookingStatus` (afterRead hook queries bookings + eventType)
    // Omit `bookings` join — counts are attached in one batched pass (see below).
    select: {
      id: true,
      startTime: true,
      endTime: true,
      active: true,
      tenant: true,
      eventType: true,
    } as any,
  } as Parameters<BasePayload["find"]>[0]);

  const timeslots = timeslotList.docs as Timeslot[];

  await Promise.all([
    attachShallowTenantAndEventType(payload, timeslots, collection, req),
    attachBookingCountsForTimeslots(payload, timeslots, collection, req),
  ]);

  return timeslots;
};

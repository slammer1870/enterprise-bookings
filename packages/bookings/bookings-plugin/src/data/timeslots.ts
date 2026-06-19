import type { CollectionSlug, Field, RelationshipField } from "payload";
import { BasePayload, PayloadRequest } from "payload";

import { getTimeslotsQuery } from "@repo/shared-utils";
import { Timeslot } from "@repo/shared-types";

import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";
import { getTimeslotStartTimeFilter, normalizeTimeslotSearchParams } from "../utils/timeslot-search-params";
import {
  findBookingsForTimeslots,
  parseNumericId,
  resolveBookingsCollectionSlug,
} from "../utils/timeslot-booking-queries";

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
  const eventTypeIdList = [...eventTypeIds];

  // Run tenant and eventType attachment in parallel:
  // they don't depend on each other and both are chunked payload.find() calls.
  await Promise.all([
    (async () => {
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
    })(),
    (async () => {
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
    })(),
  ]);

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
 * Uses one batched `payload.find()` across all timeslot IDs (same query path as the
 * expand endpoint) and aggregates counts in memory.
 */
async function attachBookingCountsForTimeslots(
  payload: BasePayload,
  timeslots: Timeslot[],
  timeslotsSlug: string,
  req?: PayloadRequest,
): Promise<void> {
  const ids = timeslots
    .map((t) => t.id)
    .map((id) => parseNumericId(id))
    .filter((id): id is number => id != null);
  if (ids.length === 0) return;

  const bookingsSlug = resolveBookingsCollectionSlug(payload, timeslotsSlug);
  const { countByTimeslot } = await findBookingsForTimeslots(
    payload,
    bookingsSlug,
    ids,
    req,
    { depth: 0, overrideAccess: true },
  );

  for (const t of timeslots) {
    const total =
      (() => {
        const rawId = t.id as unknown;
        const parsed = parseNumericId(rawId);
        return parsed != null ? countByTimeslot.get(parsed) ?? 0 : 0;
      })();
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

  // Prevent the `remainingCapacity` and `bookingStatus` virtual field afterRead hooks
  // from firing for this list query. Those hooks each make 2–5 DB round-trips per
  // timeslot; the admin list doesn't display those fields, so the work is wasted.
  // Setting `triggerAfterChange: false` on req.context is the hook's own opt-out
  // convention (see getRemainingCapacity / getBookingStatus). We set it directly on
  // req.context (rather than the `context` arg) so the existing cache entries stored
  // there are still visible to the access-control functions that run inside this find.
  if (req?.context != null) {
    (req.context as Record<string, unknown>).triggerAfterChange = false;
  }

  const timeslotList = await payload.find({
    collection,
    ...ps,
    ...(tenantId != null ? { where: searchQuery.where } : {}),
    ...(req ? { req, overrideAccess: false } : {}),
    // Only select fields needed for the admin list UI — limits the DB columns fetched.
    // Combined with `triggerAfterChange: false` above this avoids the expensive virtual
    // field hooks (`remainingCapacity`, `bookingStatus`) and the `bookings` join.
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

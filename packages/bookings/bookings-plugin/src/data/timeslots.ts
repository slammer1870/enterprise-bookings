import type { CollectionSlug, Field, RelationshipField } from "payload";
import { BasePayload, PayloadRequest } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User as SharedUser } from "@repo/shared-types";

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
 * Issues a single `payload.find()` across all timeslot IDs (selecting only the timeslot
 * FK), then aggregates counts in memory. This replaces the previous approach of one
 * `payload.count()` per timeslot (e.g. 100 DB round-trips for a full-day page).
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

  // Staff-only users should not see `pending` bookings in admin UI.
  // Filtering at the query level is both faster (less data pulled) and keeps
  // `bookings.totalDocs` consistent with what we show elsewhere.
  const requester = (req?.user ? (req.user as unknown as SharedUser) : null) as SharedUser | null;
  const excludePendingForStaffOnly =
    requester != null &&
    checkRole(["staff"], requester) &&
    !checkRole(["admin"], requester) &&
    !checkRole(["super-admin"], requester);

  const countByTimeslot = new Map<number, number>();
  for (const id of ids) countByTimeslot.set(id, 0);

  // Single query: fetch all booking rows for the given timeslot IDs, then tally counts
  // in JS. One round-trip regardless of how many timeslots are on the page.
  //
  // We intentionally omit `select` here. Using `select: { timeslot: true }` causes
  // Payload's drizzle adapter to skip joining the _rels table and inline relationship
  // columns can be unreliable — `booking.timeslot` ends up undefined for many rows,
  // making the count show 0 even when bookings exist. Without `select`, all columns
  // are returned and `booking.timeslot` is reliably the integer FK at depth: 0.
  //
  // `limit: 0` with the drizzle adapter sets `limit = undefined` internally (no SQL LIMIT),
  // so all matching rows are returned regardless of `pagination`.
  const allBookings = await payload.find({
    collection: bookingsSlug as CollectionSlug,
    where: {
      and: [
        { timeslot: { in: ids } },
        ...(excludePendingForStaffOnly ? [{ status: { not_equals: "pending" } }] : []),
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    ...(access as object),
    context: { triggerAfterChange: false },
  } as Parameters<BasePayload["find"]>[0]);

  for (const booking of allBookings.docs) {
    const rawTimeslot = (booking as any).timeslot;
    const timeslotId =
      typeof rawTimeslot === "number"
        ? rawTimeslot
        : rawTimeslot && typeof rawTimeslot === "object"
          ? (rawTimeslot as { id: number }).id
          : null;
    if (timeslotId != null && countByTimeslot.has(timeslotId)) {
      countByTimeslot.set(timeslotId, (countByTimeslot.get(timeslotId) ?? 0) + 1);
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

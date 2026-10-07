import type {
  BasePayload,
  CollectionSlug,
  Field,
  PayloadRequest,
  Where,
} from "payload";
import { checkRole } from "@repo/shared-utils";
import type { Booking, User as SharedUser } from "@repo/shared-types";

import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";

/**
 * Resolve the bookings collection from the timeslots join field — not by scanning
 * every collection with a `timeslot` relationship (that can match
 * `booking-checkout-holds` first and inflate badge counts).
 */
export function resolveBookingsCollectionSlug(
  payload: BasePayload,
  timeslotsSlug: string,
): string {
  const col = payload.config.collections?.find((c) => c.slug === timeslotsSlug);
  for (const field of (col?.fields ?? []) as Field[]) {
    if (field.type !== "join" || field.name !== "bookings") continue;
    const joinCollection = (field as { collection?: unknown }).collection;
    if (typeof joinCollection === "string" && joinCollection.length > 0) {
      return joinCollection;
    }
  }
  return DEFAULT_BOOKING_COLLECTION_SLUGS.bookings;
}

/**
 * Staff-only users see everything except `pending` bookings.
 * Org admins + platform super-admins see all booking statuses.
 */
export function shouldExcludePendingBookingsForUser(user: unknown): boolean {
  const requester = user as SharedUser | null | undefined;
  return (
    requester != null &&
    checkRole(["staff"], requester) &&
    !checkRole(["admin"], requester) &&
    !checkRole(["super-admin"], requester)
  );
}

export function timeslotBookingsStatusFilter(user: unknown): Where[] {
  return shouldExcludePendingBookingsForUser(user)
    ? [{ status: { not_equals: "pending" } }]
    : [];
}

export function parseNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value))
    return parseInt(value, 10);
  return null;
}

export function bookingTimeslotId(booking: unknown): number | null {
  if (!booking || typeof booking !== "object") return null;
  const timeslot = (booking as Booking).timeslot;
  if (typeof timeslot === "number" && Number.isFinite(timeslot))
    return timeslot;
  if (typeof timeslot === "string" && /^\d+$/.test(timeslot))
    return parseInt(timeslot, 10);
  if (timeslot && typeof timeslot === "object" && "id" in timeslot) {
    return parseNumericId((timeslot as { id: unknown }).id);
  }
  return null;
}

function bookingUserId(booking: unknown): number | null {
  if (!booking || typeof booking !== "object") return null;
  const user = (booking as { user?: unknown }).user;
  const rawId =
    user && typeof user === "object" && "id" in user
      ? (user as { id?: unknown }).id
      : user;
  return parseNumericId(rawId);
}

function bookingTenantKey(booking: unknown): string {
  if (!booking || typeof booking !== "object") return "none";
  const tenant = (booking as { tenant?: unknown }).tenant;
  const rawId =
    tenant && typeof tenant === "object" && "id" in tenant
      ? (tenant as { id?: unknown }).id
      : tenant;
  return rawId == null ? "none" : String(rawId);
}

/**
 * Marks the first confirmed booking for each user/tenant pair.
 *
 * This is kept server-side so the admin client does not need access to a user's
 * booking history just to display the label.
 */
export async function markFirstConfirmedBookings(
  payload: BasePayload,
  bookingsSlug: string,
  docs: Booking[],
  req: PayloadRequest,
): Promise<Booking[]> {
  const userIds = [
    ...new Set(
      docs.map(bookingUserId).filter((id): id is number => id != null),
    ),
  ];
  if (userIds.length === 0) return docs;

  try {
    const result = await payload.find({
      collection: bookingsSlug as CollectionSlug,
      where: {
        and: [{ user: { in: userIds } }, { status: { equals: "confirmed" } }],
      },
      depth: 0,
      pagination: false,
      limit: 10_000,
      req,
      overrideAccess: false,
      context: { triggerAfterChange: false },
    } as Parameters<BasePayload["find"]>[0]);
    const confirmed = (result.docs ?? []) as Booking[];

    const firstByUserAndTenant = new Map<string, Booking>();
    for (const booking of confirmed) {
      const userId = bookingUserId(booking);
      if (userId == null) continue;
      const key = `${userId}:${bookingTenantKey(booking)}`;
      const current = firstByUserAndTenant.get(key);
      if (
        !current ||
        new Date(booking.createdAt).getTime() <
          new Date(current.createdAt).getTime() ||
        (booking.createdAt === current.createdAt && booking.id < current.id)
      ) {
        firstByUserAndTenant.set(key, booking);
      }
    }

    return docs.map((booking) => {
      const userId = bookingUserId(booking);
      const first =
        userId == null
          ? undefined
          : firstByUserAndTenant.get(`${userId}:${bookingTenantKey(booking)}`);
      return {
        ...booking,
        isFirstConfirmedBooking: first?.id === booking.id,
      };
    });
  } catch {
    // The label is optional UI metadata; never fail the booking list if the
    // historical lookup is unavailable.
    return docs;
  }
}

type FindBookingsOptions = {
  depth?: number;
  overrideAccess?: boolean;
};

/**
 * Shared booking query for admin timeslot views.
 *
 * Uses `payload.find()` (not `count()`) so list badges and the expand endpoint
 * resolve the same documents. `count()` can disagree with `find()` under tenant
 * access + multi-tenant plugin combinations.
 */
export async function findBookingsForTimeslots(
  payload: BasePayload,
  bookingsSlug: string,
  timeslotIds: number[],
  req?: PayloadRequest,
  options?: FindBookingsOptions,
): Promise<{ docs: Booking[]; countByTimeslot: Map<number, number> }> {
  const countByTimeslot = new Map<number, number>();
  for (const id of timeslotIds) countByTimeslot.set(id, 0);

  if (timeslotIds.length === 0) {
    return { docs: [], countByTimeslot };
  }

  const statusFilter = req?.user ? timeslotBookingsStatusFilter(req.user) : [];
  const overrideAccess = options?.overrideAccess ?? true;
  const access = req ? { req, overrideAccess } : { overrideAccess };

  const result = await payload.find({
    collection: bookingsSlug as CollectionSlug,
    where: {
      and: [{ timeslot: { in: timeslotIds } }, ...statusFilter],
    },
    depth: options?.depth ?? 0,
    pagination: false,
    limit: 10_000,
    ...(access as object),
    context: { triggerAfterChange: false },
  } as Parameters<BasePayload["find"]>[0]);

  const docs = (result.docs ?? []) as Booking[];
  for (const doc of docs) {
    const timeslotId = bookingTimeslotId(doc);
    if (timeslotId == null) continue;
    countByTimeslot.set(timeslotId, (countByTimeslot.get(timeslotId) ?? 0) + 1);
  }

  return { docs, countByTimeslot };
}

export async function findBookingsForTimeslot(
  payload: BasePayload,
  bookingsSlug: string,
  timeslotId: number,
  req: PayloadRequest,
  options?: FindBookingsOptions,
): Promise<{ docs: Booking[]; totalDocs: number }> {
  const { docs, countByTimeslot } = await findBookingsForTimeslots(
    payload,
    bookingsSlug,
    [timeslotId],
    req,
    options,
  );

  return {
    docs,
    totalDocs: countByTimeslot.get(timeslotId) ?? docs.length,
  };
}

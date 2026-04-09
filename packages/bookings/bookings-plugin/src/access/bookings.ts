import type { Access, CollectionSlug } from "payload";

type AccessArgs<T> = Parameters<Access<T>> extends never
  ? { req: any; id?: string | number; data?: any }
  : Parameters<Extract<Access<T>, (..._args: any[]) => any>> extends infer P
    ? P extends [infer A]
      ? A
      : never
    : never;

import { Booking, Timeslot, User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";
import type { BookingCollectionSlugs } from "../resolve-slugs";

function normalizeID(id: unknown): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string") {
    const n = parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Platform + tenant operators (super-admin, tenant admin `admin`). */
function isElevatedOperator(user: User | null): boolean {
  return checkRole(["super-admin", "admin"], user);
}

export function createBookingAccess(slugs: BookingCollectionSlugs) {
  const timeslotsSlug = slugs.timeslots;

  const bookingCreateAccess = async ({
    req,
    data,
  }: AccessArgs<Booking>) => {
    const user = req.user as User | null;

    if (!data?.timeslot) return false;

    const timeslotId =
      typeof data?.timeslot === "object" ? data?.timeslot.id : data?.timeslot;

    try {
      const timeslot = (await req.payload.findByID({
        collection: timeslotsSlug as CollectionSlug,
        id: timeslotId,
        depth: 3,
        overrideAccess: true,
        context: {
          triggerAfterChange: false,
        },
      })) as unknown as Timeslot;

      if (!timeslot) return false;

      if (!user) return false;

      if (isElevatedOperator(user)) return true;

      if (timeslot.bookingStatus === "waitlist" && data.status === "waiting") {
        return true;
      }

      if (
        timeslot.bookingStatus === "closed" ||
        timeslot.bookingStatus === "booked"
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const bookingUpdateAccess = async ({
    req,
    id,
  }: AccessArgs<Booking>) => {
    const searchParams = req.searchParams;

    const timeslotId = searchParams.get("where[and][0][timeslot][equals]") || id;

    if (!timeslotId) return false;

    let booking: Booking | undefined;

    try {
      const requester = req.user as User | null;
      const requesterId = normalizeID(requester?.id);
      if (!requesterId) return false;

      if (requester && isElevatedOperator(requester)) return true;

      if (id) {
        booking = (await req.payload.findByID({
          collection: "bookings",
          id,
          depth: 3,
          overrideAccess: true,
        })) as unknown as Booking;
      } else {
        const bookingQuery = await req.payload.find({
          collection: "bookings",
          where: {
            timeslot: { equals: timeslotId },
            user: { equals: requesterId },
          },
          depth: 3,
          overrideAccess: true,
        });

        booking = bookingQuery.docs[0] as unknown as Booking | undefined;
      }

      if (!booking) return false;

      const bookingUserId = normalizeID(
        (booking as any)?.user?.id ?? (booking as any)?.user
      );
      if (!bookingUserId) return false;
      if (bookingUserId !== requesterId) return false;

      if (req.data?.status === "cancelled") return true;

      if (
        (booking as any)?.timeslot?.bookingStatus === "closed" ||
        (booking as any)?.timeslot?.bookingStatus === "waitlist"
      ) {
        const timeslotLookup = (await req.payload.findByID({
          collection: timeslotsSlug as CollectionSlug,
          id: (booking as any)?.timeslot?.id ?? (booking as any)?.timeslot,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Timeslot | null;
        if (!timeslotLookup) return false;
        if (
          timeslotLookup.bookingStatus === "closed" ||
          timeslotLookup.bookingStatus === "waitlist"
        )
          return false;
      }

      return true;
    } catch (error) {
      console.error("Error in bookingUpdateAccess:", error);
      return false;
    }
  };

  const isAdminOrOwner = ({ req }: AccessArgs<Booking>) => {
    const user = req.user as User | null;

    if (!user) return false;

    if (isElevatedOperator(user)) return true;

    return {
      user: { equals: user.id },
    };
  };

  return {
    bookingCreateAccess,
    bookingUpdateAccess,
    isAdminOrOwner,
  };
}

/** @deprecated Prefer createBookingAccess(slugs) when using custom collection slugs. */
const _legacyAccess = createBookingAccess(DEFAULT_BOOKING_COLLECTION_SLUGS);
export const bookingCreateAccess = _legacyAccess.bookingCreateAccess;
export const bookingUpdateAccess = _legacyAccess.bookingUpdateAccess;
export const isAdminOrOwner = _legacyAccess.isAdminOrOwner;

import type { Access, CollectionSlug } from "payload";

type AccessArgs<T> = Parameters<Access<T>> extends never
  ? { req: any; id?: string | number; data?: any }
  : Parameters<Extract<Access<T>, (...args: any[]) => any>> extends infer P
    ? P extends [infer A]
      ? A
      : never
    : never;

import { Booking, Lesson, User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

import { DEFAULT_BOOKINGS_PLUGIN_SLUGS } from "../resolve-slugs";
import type { BookingsPluginSlugs } from "../resolve-slugs";

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

export function createBookingAccess(slugs: BookingsPluginSlugs) {
  const lessonsSlug = slugs.lessons;

  const bookingCreateAccess = async ({
    req,
    data,
  }: AccessArgs<Booking>) => {
    const user = req.user as User | null;

    if (!data?.lesson) return false;

    const lessonId =
      typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

    try {
      const lesson = (await req.payload.findByID({
        collection: lessonsSlug as CollectionSlug,
        id: lessonId,
        depth: 3,
        overrideAccess: true,
        context: {
          triggerAfterChange: false,
        },
      })) as unknown as Lesson;

      if (!lesson) return false;

      if (!user) return false;

      if (isElevatedOperator(user)) return true;

      if (lesson.bookingStatus === "waitlist" && data.status === "waiting") {
        return true;
      }

      if (
        lesson.bookingStatus === "closed" ||
        lesson.bookingStatus === "booked"
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

    const lessonId = searchParams.get("where[and][0][lesson][equals]") || id;

    if (!lessonId) return false;

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
            lesson: { equals: lessonId },
            user: { equals: requesterId },
          },
          depth: 3,
          overrideAccess: true,
        });

        booking = bookingQuery.docs[0] as Booking | undefined;
      }

      if (!booking) return false;

      const bookingUserId = normalizeID(
        (booking as any)?.user?.id ?? (booking as any)?.user
      );
      if (!bookingUserId) return false;
      if (bookingUserId !== requesterId) return false;

      if (req.data?.status === "cancelled") return true;

      if (
        (booking as any)?.lesson?.bookingStatus === "closed" ||
        (booking as any)?.lesson?.bookingStatus === "waitlist"
      ) {
        const lessonLookup = (await req.payload.findByID({
          collection: lessonsSlug as CollectionSlug,
          id: (booking as any)?.lesson?.id ?? (booking as any)?.lesson,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Lesson | null;
        if (!lessonLookup) return false;
        if (
          lessonLookup.bookingStatus === "closed" ||
          lessonLookup.bookingStatus === "waitlist"
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
const _legacyAccess = createBookingAccess(DEFAULT_BOOKINGS_PLUGIN_SLUGS);
export const bookingCreateAccess = _legacyAccess.bookingCreateAccess;
export const bookingUpdateAccess = _legacyAccess.bookingUpdateAccess;

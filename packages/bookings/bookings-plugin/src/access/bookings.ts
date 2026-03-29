import { AccessArgs } from "payload";

import { Booking, Lesson, User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils";

function normalizeID(id: unknown): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string") {
    const n = parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const bookingCreateAccess = async ({
  req,
  data,
}: AccessArgs<Booking>) => {
  const user = req.user as User | null;

  if (!data?.lesson) return false;

  const lessonId =
    typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

  try {
    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: lessonId,
      depth: 3,
      // Access functions often need to read related docs to decide permissions.
      // Use overrideAccess to avoid tenant-scoped filtering causing false negatives.
      overrideAccess: true,
      context: {
        triggerAfterChange: false, // Don't trigger hooks that might affect bookingStatus calculation
      },
    })) as unknown as Lesson;

    if (!lesson) return false;

    if (!user) return false;

    if (checkRole(["admin"], user)) return true;

    if (lesson.bookingStatus === "waitlist" && data.status === "waiting") {
      return true;
    }

    if (
      lesson.bookingStatus === "closed" ||
      lesson.bookingStatus === "booked"
    ) {
      return false;
    }

    // if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
    //   return false;
    // }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const bookingUpdateAccess = async ({
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

    // Admins can update any booking.
    if (requester && checkRole(["admin"], requester)) return true;

    if (id) {
      booking = (await req.payload.findByID({
        collection: "bookings",
        id,
        depth: 3,
        // Access functions must be able to read the target doc to evaluate ownership.
        // This does NOT grant access by itself; we enforce ownership below.
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

    // Cancellation is always allowed for the owner (even if lesson is closed/waitlist).
    if (req.data?.status === "cancelled") return true;

    // For other updates (rare in app flows), ensure lesson is not closed/waitlist.
    if (
      (booking as any)?.lesson?.bookingStatus === "closed" ||
      (booking as any)?.lesson?.bookingStatus === "waitlist"
    ) {
      // If lesson isn't populated with bookingStatus, fetch it.
      const lessonLookup = (await req.payload.findByID({
        collection: "lessons",
        id: (booking as any)?.lesson?.id ?? (booking as any)?.lesson,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Lesson | null;
      if (!lessonLookup) return false;
      if (lessonLookup.bookingStatus === "closed" || lessonLookup.bookingStatus === "waitlist")
        return false;
    }

    // if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
    //   return false;
    // }

    return true;
  } catch (error) {
    console.error("Error in bookingUpdateAccess:", error);
    return false;
  }
};

export const isAdminOrOwner = ({ req }: AccessArgs<Booking>) => {
  const user = req.user as User | null;

  if (!user) return false;

  if (checkRole(["admin"], user)) return true;

  return {
    user: { equals: user.id },
  };
};

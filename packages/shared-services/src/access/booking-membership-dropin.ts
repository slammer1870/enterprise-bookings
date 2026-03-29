import { Booking, Lesson, User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";
import { AccessArgs } from "payload";

// Helper function to validate lesson status and capacity
import { validateLessonStatus } from "../lesson";

import { validateLessonPaymentMethods } from "../lesson";

function normalizeID(id: unknown): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string") {
    const n = parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const bookingCreateMembershipDropinAccess = async ({
  req,
  data,
}: AccessArgs<Booking>) => {
  const user = req.user as unknown as User | null;

  if (!user) {
    return false;
  }

  if (!data?.lesson) return false;

  const lessonId =
    typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

  try {
    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: lessonId,
      depth: 3,
      overrideAccess: true,
    })) as unknown as Lesson;

    if (!lesson || !user) return false;

    if (checkRole(["admin"], user)) return true;

    if (lesson.bookingStatus === "waitlist" && data.status === "waiting") {
      return true;
    }

    if (!validateLessonStatus(lesson)) return false;

    return await validateLessonPaymentMethods(lesson, user, req.payload);
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const bookingUpdateMembershipDropinAccess = async ({
  req,
  id,
}: AccessArgs<Booking>) => {
  const searchParams = req.searchParams;

  const lessonId = searchParams.get("where[and][0][lesson][equals]") || id;
  const userId =
    searchParams.get("where[and][1][user][equals]") || req.user?.id;

  if (!lessonId) return false;

  let booking: Booking | undefined;

  try {
    const requester = req.user as unknown as User | null;
    const requesterId = normalizeID(requester?.id);
    if (!requesterId) return false;

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
          user: { equals: userId ?? requesterId },
        },
        depth: 3,
        overrideAccess: true,
      });

      booking = bookingQuery.docs[0] as Booking | undefined;
    }

    if (!booking) return false;

    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: booking.lesson.id,
      depth: 3,
      overrideAccess: true,
    })) as unknown as Lesson;

    const user = (await req.payload.findByID({
      collection: "users",
      id: userId ?? booking.user.id,
      depth: 3,
      overrideAccess: true,
    })) as unknown as User;

    if (!lesson || !user) return false;

    if (requester && checkRole(["admin"], requester)) return true;

    const bookingUserId = normalizeID(user.id);
    if (!bookingUserId) return false;
    if (requesterId !== bookingUserId) return false;

    if (req.data?.status === "cancelled") return true;

    if (!validateLessonStatus(lesson)) return false;

    return await validateLessonPaymentMethods(lesson, user, req.payload);
  } catch (error) {
    console.error(error);
    return false;
  }
};

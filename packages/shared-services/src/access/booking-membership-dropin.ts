import { Booking, Lesson, Plan, Subscription, User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils";
import { AccessArgs, CollectionSlug } from "payload";
import { hasReachedSubscriptionLimit } from "..";

// Helper function to validate lesson status and capacity
import { validateLessonStatus } from "../lesson";

import { validateLessonPaymentMethods } from "../lesson";

export const bookingCreateMembershipDropinAccess = async ({
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
    })) as unknown as Lesson;

    if (!lesson || !user) return false;

    if (checkRole(["admin"], user)) return true;

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
    if (id) {
      booking = (await req.payload.findByID({
        collection: "bookings",
        id,
        depth: 3,
      })) as unknown as Booking;
    } else {
      const bookingQuery = await req.payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lessonId },
          user: { equals: userId },
        },
        depth: 3,
      });

      booking = bookingQuery.docs[0] as Booking | undefined;
    }

    if (!booking) return false;

    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: booking.lesson.id,
      depth: 3,
    })) as unknown as Lesson;

    const user = (await req.payload.findByID({
      collection: "users",
      id: userId || booking.user.id,
      depth: 3,
    })) as unknown as User;

    if (!lesson || !user) return false;

    if (checkRole(["admin"], user)) return true;

    if (req.user?.id !== user.id) return false;

    if (req.data?.status === "cancelled") return true;

    if (!validateLessonStatus(lesson)) return false;

    return await validateLessonPaymentMethods(lesson, user, req.payload);
  } catch (error) {
    console.error(error);
    return false;
  }
};

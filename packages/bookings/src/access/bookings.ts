import { AccessArgs, CollectionSlug } from "payload";

import { Access } from "payload";

import { BookingsPluginConfig } from "../types";

import { Booking, Lesson, User, Subscription, Plan } from "@repo/shared-types";

import { hasReachedSubscriptionLimit } from "@repo/shared-services";

import { checkRole } from "@repo/shared-utils";

export const bookingCreateAccess = async ({
  req,
  data,
}: AccessArgs<Booking>) => {
  const user = req.user as User | null;

  console.log("USER", user);

  console.log("DATA", data);

  if (!data?.lesson) return false;

  console.log("DATA PASSING", data);

  const lessonId =
    typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

  try {
    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: lessonId,
      depth: 3,
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
  data,
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

    if (
      lesson.bookingStatus == "closed" ||
      lesson.bookingStatus == "waitlist"
    ) {
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

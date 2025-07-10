import { Booking, Lesson, User } from "@repo/shared-types";
import { AccessArgs } from "payload";
import { validateLessonStatus } from "../lesson";
import { validateLessonPaymentMethods } from "../lesson";
import { checkRole } from "@repo/shared-utils";

export const childrenCreateBookingMembershipAccess = async ({
  req,
  data,
}: AccessArgs<Booking>): Promise<boolean> => {
  let user = req.user as User | null;

  if (!user) return false;

  if (!data?.lesson) return false;

  const lessonId =
    typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

  try {
    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: lessonId,
      depth: 3,
    })) as Lesson;

    if (!lesson) return false;

    if (lesson.classOption.type == "child") {
      if (!user.parent.id) return false;

      user = (await req.payload.findByID({
        collection: "users",
        id: user.parent.id,
      })) as User;
    }

    if (lesson.bookingStatus === "waitlist" && data.status === "waiting") {
      return true;
    }

    if (!validateLessonStatus(lesson)) return false;

    return await validateLessonPaymentMethods(lesson, user, req.payload);

    //check that number of children is booked is less than the number of or equal number of children on plan
  } catch (error) {
    console.error("Error in childrenCreateBookingMembershipAccess", error);
    return false;
  }
};

export const childrenUpdateBookingMembershipAccess = async ({
  req,
  id,
}: AccessArgs<Booking>): Promise<boolean> => {
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

    let user = req.user as User | null;

    if (lesson.classOption.type == "child") {
      if (!user?.parent.id) return false;

      user = (await req.payload.findByID({
        collection: "users",
        id: user.parent.id,
      })) as User;
    }

    if (!lesson || !user) return false;

    if (checkRole(["admin"], user)) return true;

    if (req.user?.parent?.id !== user.id) return false;

    if (req.data?.status === "cancelled") return true;

    if (!validateLessonStatus(lesson)) return false;

    return await validateLessonPaymentMethods(lesson, user, req.payload);
  } catch (error) {
    console.error(error);
    return false;
  }
};

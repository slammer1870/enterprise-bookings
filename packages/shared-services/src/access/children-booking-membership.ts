import { Booking, Lesson, User } from "@repo/shared-types";
import { AccessArgs } from "payload";
import { validateLessonStatus, validateLessonPaymentMethods } from "../lesson";
import { checkRole } from "@repo/shared-utils";

export const childrenCreateBookingMembershipAccess = async ({
  req,
  data,
}: AccessArgs<Booking>): Promise<boolean> => {
  if (!req.user) return false;

  const { payload } = req;

  const userId = typeof req.user === "object" ? req.user.id : req.user;

  if (!userId) {
    payload.logger.error("User ID is required", {
      userId,
    });
    return false;
  }

  let user: User;

  user = (await payload.findByID({
    collection: "users",
    id: userId,
    depth: 2,
  })) as User;

  if (!user) {
    payload.logger.error("User not found", {
      userId,
    });
    return false;
  }

  if (checkRole(["admin"], user)) return true;

  if (!data?.lesson) {
    payload.logger.error("Lesson is required", {
      lessonId: data?.lesson?.id,
    });
    return false;
  }

  const lessonId =
    typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

  try {
    const lesson = (await payload.findByID({
      collection: "lessons",
      id: lessonId,
      depth: 3,
    })) as unknown as Lesson;

    if (!lesson) {
      payload.logger.error("Lesson not found", {
        lessonId,
      });
      return false;
    }

    if (lesson.classOption.type == "child") {
      if (!user.parent) {
        payload.logger.error("User has no parent", {
          userId,
        });
        return false;
      }

      const parentId =
        typeof user.parent === "object" ? user.parent.id : user.parent;

      user = (await payload.findByID({
        collection: "users",
        id: parentId,
      })) as User;
    }

    if (lesson.bookingStatus === "waitlist" && data.status === "waiting") {
      payload.logger.info("User is on waitlist", {
        userId,
        lessonId,
      });
      return true;
    }

    if (data.status === "pending") {
      payload.logger.info("Booking is pending", {
        booking: data,
      });
      return true;
    }

    if (!validateLessonStatus(lesson)) {
      payload.logger.error("Lesson status is not valid", {
        lesson,
      });
      return false;
    }

    return await validateLessonPaymentMethods(lesson, user, payload);

    //check that number of children is booked is less than the number of or equal number of children on plan
  } catch (error) {
    console.error("Error in childrenCreateBookingMembershipAccess", error);
    return false;
  }
};

export const childrenUpdateBookingMembershipAccess = async ({
  req,
  id,
  data,
}: AccessArgs<Booking>): Promise<boolean> => {
  if (!req.user) {
    req.payload.logger.error("User is not authenticated", {
      userId: req.user,
    });
    return false;
  }

  const { payload } = req;

  const searchParams = req.searchParams;

  const lessonId = searchParams?.get("where[and][0][lesson][equals]") || id;
  const userId =
    searchParams?.get("where[and][1][user][equals]") ||
    (typeof req.user === "object" ? req.user.id : req.user);

  // If we don't have lessonId or userId, this might be a read operation
  // In that case, we can return true since read access is handled separately
  if (!lessonId || !userId) {
    // If this is called during a read operation (no specific booking ID), allow it
    // The actual read access control is handled by the read access function

    req.payload.logger.error("Lesson ID or User ID is required", {
      lessonId,
      userId,
    });
    return false;
  }

  let booking: Booking | undefined;

  let user: User;

  user = (await payload.findByID({
    collection: "users",
    id: userId,
  })) as User;

  if (checkRole(["admin"], user)) return true;

  try {
    if (id) {
      booking = (await payload.findByID({
        collection: "bookings",
        id,
        depth: 3,
      })) as unknown as Booking;
    } else {
      const bookingQuery = await payload.find({
        collection: "bookings",
        where: {
          lesson: { equals: lessonId },
          user: { equals: userId },
        },
        depth: 3,
      });

      booking = bookingQuery.docs[0] as Booking | undefined;
    }

    if (!booking) {
      req.payload.logger.error("Booking not found", {
        bookingId: id,
      });
      return false;
    }

    const lesson = (await payload.findByID({
      collection: "lessons",
      id: booking.lesson.id,
      depth: 3,
    })) as unknown as Lesson;

    if (lesson.classOption.type == "child") {
      if (!user?.parent) {
        req.payload.logger.error("User has no parent", {
          userId,
        });
        return false;
      }

      const parentId =
        typeof user.parent === "object" ? user.parent.id : user.parent;

      user = (await payload.findByID({
        collection: "users",
        id: parentId,
      })) as User;
    }

    if (!lesson || !user) {
      req.payload.logger.error("Lesson or user not found", {
        lessonId,
        userId,
      });
      return false;
    }

    if (checkRole(["admin"], user)) return true;

    if (data?.status === "cancelled") return true;

    if (data?.status === "pending") return true;

    if (lesson.bookingStatus === data?.status) {
      req.payload.logger.info(
        "Lesson booking status is the same as the request status",
        {
          lessonId,
          userId,
          status: data?.status,
        }
      );
      return true;
    }

    if (!validateLessonStatus(lesson)) {
      req.payload.logger.error("Lesson status is not valid", {
        lesson,
      });
      return false;
    }

    return await validateLessonPaymentMethods(lesson, user, payload);
  } catch (error) {
    req.payload.logger.error("Error in childrenUpdateBookingMembershipAccess", {
      error,
    });
    return false;
  }
};

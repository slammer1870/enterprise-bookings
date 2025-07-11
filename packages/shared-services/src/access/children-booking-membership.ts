import { Booking, Lesson, Subscription, User } from "@repo/shared-types";
import { AccessArgs, Payload } from "payload";
import { validateLessonStatus } from "../lesson";
import { validateLessonPaymentMethods } from "../lesson";
import { checkRole } from "@repo/shared-utils";

const validatePlanLimit = async (
  lesson: Lesson,
  user: User,
  payload: Payload
) => {
  const subscriptionQuery = await payload.find({
    collection: "subscriptions",
    where: {
      user: { equals: user.id },
      status: { equals: "active" },
      startDate: { less_than_equal: new Date().toISOString() },
      endDate: { greater_than_equal: new Date().toISOString() },
    },
    depth: 4,
  });

  const subscription = subscriptionQuery.docs[0] as Subscription | undefined;

  if (!subscription) return false;

  const plan = subscription.plan;

  if (!plan) return false;

  if (!["child", "family"].includes(plan.type)) return false;

  const bookings = await payload.find({
    collection: "bookings",
    where: {
      lesson: { equals: lesson.id },
      "user.parent": { equals: user.id },
      status: { equals: "confirmed" },
    },
  });

  if (!(bookings.docs.length <= plan.quantity)) return false;

  return true;
};

export const childrenCreateBookingMembershipAccess = async ({
  req,
  data,
}: AccessArgs<Booking>): Promise<boolean> => {
  const userId = typeof req.user === "object" ? req.user.id : req.user;

  console.log("USER", userId);

  if (!userId) return false;

  let user: User;

  user = (await req.payload.findByID({
    collection: "users",
    id: userId,
  })) as User;

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

    console.log("LESSON", lesson);

    if (!lesson) return false;

    if (lesson.classOption.type == "child") {
      if (!user.parent) return false;

      const parentId =
        typeof user.parent === "object" ? user.parent.id : user.parent;

      user = (await req.payload.findByID({
        collection: "users",
        id: parentId,
      })) as User;

      console.log("PARENT USER", user);
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
    searchParams.get("where[and][1][user][equals]") ||
    (typeof req.user === "object" ? req.user.id : req.user);

  if (!lessonId || !userId) return false;

  let booking: Booking | undefined;

  let user: User;

  user = (await req.payload.findByID({
    collection: "users",
    id: userId,
  })) as User;

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

    if (lesson.classOption.type == "child") {
      if (!user?.parent) return false;

      const parentId =
        typeof user.parent === "object" ? user.parent.id : user.parent;

      user = (await req.payload.findByID({
        collection: "users",
        id: parentId,
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

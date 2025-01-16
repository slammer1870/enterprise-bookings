import { AccessArgs } from "payload";

import { Access } from "payload";
import { Booking, Lesson, User } from "../types";

export const isAdminOrMember: Access = async ({
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
    })) as unknown as Lesson;

    if (!lesson) return false;

    if (!user) return false;

    if (user.roles && user.roles?.includes("admin")) return true;

    if (lesson.bookingStatus !== "active") {
      return false;
    }

    if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
      return false;
    }

    // Check if the lesson has an allowed plan payment method
    if (lesson.classOption.paymentMethods?.allowedPlans) {
      //TODO: Check if the user has a subscription plan that is allowed for this lesson
    }

    //TODO default this to true
    return false;
  } catch (error) {
    console.error(error);
    return false;
  }
};

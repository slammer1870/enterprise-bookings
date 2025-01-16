import { AccessArgs, Where } from "payload";

import { Access } from "payload";
import { Booking } from "../types";

export const isAdminOrMember: Access = async ({
  req,
  data,
}: AccessArgs<Booking>) => {
  const { user } = req;

  if (!data?.lesson) return false;

  const lessonId =
    typeof data?.lesson === "object" ? data?.lesson.id : data?.lesson;

  try {
    const lesson = await req.payload.findByID({
      collection: "lessons",
      id: lessonId,
    });

    if (!lesson) return false;

    if (!user) return false;

    if (user?.roles?.includes("admin")) return true;

    if (lesson.bookingStatus !== "active") {
      return false;
    }

    if (lesson.remainingCapacity <= 0) {
      return false;
    }

    // Check if the lesson has an allowed plan payment method
    if (lesson.classOptions.paymentMethods.allowedPlans) {
      return lesson.classOptions.paymentMethods.allowedPlans.includes(
        user.subscriptionPlan
      );
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

import { Lesson, User } from "@repo/shared-types";
import { checkUserSubscription } from "./subscription";

// Helper function to validate lesson status and capacity
export const validateLessonStatus = (lesson: Lesson): boolean => {
  if (lesson.bookingStatus === "closed" || lesson.bookingStatus === "booked") {
    return false;
  }

  if (lesson.remainingCapacity && lesson.remainingCapacity <= 0) {
    return false;
  }

  return true;
};

// Helper function to validate lesson payment methods
export const validateLessonPaymentMethods = async (
  lesson: Lesson,
  user: User,
  payload: any
): Promise<boolean> => {
  if (
    lesson.classOption.paymentMethods?.allowedPlans &&
    lesson.classOption.paymentMethods?.allowedPlans.length > 0
  ) {
    return await checkUserSubscription(user, lesson, payload);
  }

  if (lesson.classOption.paymentMethods?.allowedDropIn) {
    return false;
  }

  return true;
};

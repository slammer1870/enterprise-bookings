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
  try {
    // Ensure classOption is fully populated
    let classOption = lesson.classOption;
    
    // If classOption is just an ID, fetch it
    if (typeof classOption === "number") {
      try {
        classOption = await payload.findByID({
          collection: "class-options",
          id: classOption,
          depth: 2,
        });
      } catch (error) {
        console.error("Error fetching classOption:", error);
        return false;
      }
    }
    
    // If classOption is an object but paymentMethods is not defined (not null, but undefined), fetch it
    // Note: null means explicitly no payment methods, undefined means not loaded
    if (
      typeof classOption === "object" &&
      classOption !== null &&
      classOption.paymentMethods === undefined
    ) {
      try {
        classOption = await payload.findByID({
          collection: "class-options",
          id: classOption.id,
          depth: 2,
        });
      } catch (error) {
        console.error("Error fetching classOption:", error);
        return false;
      }
    }

    // Check if classOption has payment methods with allowed plans
    const allowedPlans = classOption?.paymentMethods?.allowedPlans;
    if (
      allowedPlans &&
      Array.isArray(allowedPlans) &&
      allowedPlans.length > 0
    ) {
      // Create a lesson object with the populated classOption for checkUserSubscription
      const lessonWithPopulatedClassOption = {
        ...lesson,
        classOption,
      };
      return await checkUserSubscription(
        user,
        lessonWithPopulatedClassOption as Lesson,
        payload
      );
    }

    // If lesson has drop-in payment method, users cannot book directly
    if (classOption?.paymentMethods?.allowedDropIn) {
      return false;
    }

    // If no payment methods are required (paymentMethods is null, undefined, or empty), allow booking
    return true;
  } catch (error) {
    console.error("Error in validateLessonPaymentMethods:", error);
    return false;
  }
};

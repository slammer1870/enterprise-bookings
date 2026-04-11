import { Timeslot, User } from "@repo/shared-types";
import { checkUserSubscription } from "./subscription";

// Helper function to validate timeslot status and capacity
export const validateTimeslotStatus = (timeslot: Timeslot): boolean => {
  if (timeslot.bookingStatus === "closed" || timeslot.bookingStatus === "booked") {
    return false;
  }

  if (timeslot.remainingCapacity && timeslot.remainingCapacity <= 0) {
    return false;
  }

  return true;
};

// Helper function to validate timeslot payment methods
export const validateTimeslotPaymentMethods = async (
  timeslot: Timeslot,
  user: User,
  payload: any
): Promise<boolean> => {
  try {
    // Ensure eventType is fully populated
    let eventType = timeslot.eventType;
    
    // If eventType is just an ID, fetch it
    if (typeof eventType === "number") {
      try {
        eventType = await payload.findByID({
          collection: "event-types",
          id: eventType,
          depth: 2,
        });
      } catch (error) {
        console.error("Error fetching eventType:", error);
        return false;
      }
    }
    
    // If eventType is an object but paymentMethods is not defined (not null, but undefined), fetch it
    // Note: null means explicitly no payment methods, undefined means not loaded
    if (
      typeof eventType === "object" &&
      eventType !== null &&
      eventType.paymentMethods === undefined
    ) {
      try {
        eventType = await payload.findByID({
          collection: "event-types",
          id: eventType.id,
          depth: 2,
        });
      } catch (error) {
        console.error("Error fetching eventType:", error);
        return false;
      }
    }

    // Check if eventType has payment methods with allowed plans
    const allowedPlans = eventType?.paymentMethods?.allowedPlans;
    if (
      allowedPlans &&
      Array.isArray(allowedPlans) &&
      allowedPlans.length > 0
    ) {
      // Create a timeslot object with the populated eventType for checkUserSubscription
      const lessonWithPopulatedEventType = {
        ...timeslot,
        eventType,
      };
      return await checkUserSubscription(
        user,
        lessonWithPopulatedEventType as Timeslot,
        payload
      );
    }

    // If timeslot has drop-in payment method, users cannot book directly
    if (eventType?.paymentMethods?.allowedDropIn) {
      return false;
    }

    // If no payment methods are required (paymentMethods is null, undefined, or empty), allow booking
    return true;
  } catch (error) {
    console.error("Error in validateTimeslotPaymentMethods:", error);
    return false;
  }
};

import { Booking, ClassOption, User } from "@repo/shared-types";

import { FieldHook } from "payload";

// Constants
const MILLISECONDS_PER_MINUTE = 60000;

// Helper type guards and utilities
const getUserId = (user: unknown): number | null => {
  if (!user) return null;
  return typeof user === "object" && user !== null && "id" in user
    ? (user as { id: number }).id
    : (user as number);
};

const getUserFromBooking = (booking: Booking): User => {
  return typeof booking.user === "object" && booking.user !== null
    ? (booking.user as User)
    : (booking.user as unknown as User);
};

const getParentId = (user: User): number | null => {
  if (!user.parentUser) return null;
  return typeof user.parentUser === "object" && user.parentUser !== null
    ? user.parentUser.id
    : (user.parentUser as unknown as number);
};

const isLessonClosed = (
  startTime: string | undefined,
  lockOutTime: number | undefined,
  currentTime: Date
): boolean => {
  if (!startTime) {
    return false;
  }

  const startTimeDate = new Date(startTime);
  const startTimeMs = startTimeDate.getTime();

  // Check if date is valid
  if (isNaN(startTimeMs)) {
    return false;
  }

  // If lesson has already started, it's closed
  if (currentTime.getTime() >= startTimeMs) {
    return true;
  }

  // If lockOutTime is not defined or is null, only check if lesson has started
  if (lockOutTime === undefined || lockOutTime === null) {
    return false;
  }

  // If lockOutTime is 0, only check if lesson has started (already checked above)
  if (lockOutTime === 0) {
    return false;
  }

  // Check if we're past the lock-out deadline
  const lockOutDeadline = startTimeMs - lockOutTime * MILLISECONDS_PER_MINUTE;
  return currentTime.getTime() >= lockOutDeadline;
};

const getConfirmedBookingsCount = (bookings: Booking[]): number => {
  return bookings.filter((booking) => booking.status === "confirmed").length;
};

const hasUserConfirmedBooking = (
  bookings: Booking[],
  userId: number
): boolean => {
  return bookings.some(
    (booking) =>
      getUserFromBooking(booking).id === userId &&
      booking.status === "confirmed"
  );
};

const hasUserWaitingBooking = (
  bookings: Booking[],
  userId: number
): boolean => {
  return bookings.some(
    (booking) =>
      getUserFromBooking(booking).id === userId && booking.status === "waiting"
  );
};

const hasParentConfirmedBooking = (
  bookings: Booking[],
  parentId: number
): boolean => {
  return bookings.some((booking) => {
    const user = getUserFromBooking(booking);
    const bookingParentId = getParentId(user);
    return bookingParentId === parentId && booking.status === "confirmed";
  });
};

const isTrialable = (classOption: ClassOption): boolean => {
  return (
    classOption.paymentMethods?.allowedDropIn?.discountTiers?.some(
      (tier) => tier.type === "trial"
    ) ?? false
  );
};

export const getBookingStatus: FieldHook = async ({ req, data, context }) => {
  // Early return if hook should not run
  if (context.triggerAfterChange === false) {
    return;
  }

  // Validate required data
  if (!data?.id || !data?.classOption) {
    return "active";
  }

  const currentTime = new Date();
  const userId = getUserId(req.user);

  try {
    // Fetch class option
    const classOption = (await req.payload.findByID({
      collection: "class-options",
      id: data.classOption,
    })) as unknown as ClassOption;

    if (!classOption) {
      return "active";
    }

    // Fetch all bookings for this lesson once
    const bookingQuery = await req.payload.find({
      collection: "bookings",
      depth: 3,
      where: {
        lesson: {
          equals: data.id,
        },
      },
      context: {
        triggerAfterChange: false,
      },
    });

    const bookings = bookingQuery.docs as unknown as Booking[];
    const confirmedCount = getConfirmedBookingsCount(bookings);
    const isFull = confirmedCount >= classOption.places;
    const trialable = isTrialable(classOption);

    if (isLessonClosed(data.startTime, undefined, currentTime)) {
      return "closed";
    }

    // Check children bookings (only for child classes) - check this first
    if (classOption.type === "child" && userId) {
      if (hasParentConfirmedBooking(bookings, userId)) {
        return "childrenBooked";
      }
    }

    // Check if user already has a confirmed booking - check before checking if lesson is closed
    if (userId && hasUserConfirmedBooking(bookings, userId)) {
      return "booked";
    }

    // Check if user is on waiting list
    if (userId && hasUserWaitingBooking(bookings, userId) && isFull) {
      return "waiting";
    }

    // Check if lesson is closed (lock-out time) - check after user booking status
    if (isLessonClosed(data.startTime, data.lockOutTime, currentTime)) {
      return "closed";
    }

    // Check if class is full (waitlist)
    if (isFull) {
      return "waitlist";
    }

    // Handle trialable logic
    if (trialable) {
      if (!userId) {
        return "trialable";
      }

      // Check if user has any confirmed bookings
      // For child classes, check parent's bookings; for adult classes, check user's bookings
      const bookingCheckQuery = await req.payload.find({
        collection: "bookings",
        depth: 1,
        limit: 1,
        where: {
          and: [
            classOption.type === "child"
              ? {
                  "user.parentUser": {
                    equals: userId,
                  },
                }
              : {
                  user: {
                    equals: userId,
                  },
                },
            {
              status: {
                equals: "confirmed",
              },
            },
          ],
        },
        context: {
          triggerAfterChange: false,
        },
      });

      return bookingCheckQuery.docs.length > 0 ? "active" : "trialable";
    }

    return "active";
  } catch (error) {
    // Log error in production, but return a safe default
    console.error("Error calculating booking status:", error);
    return "active";
  }
};

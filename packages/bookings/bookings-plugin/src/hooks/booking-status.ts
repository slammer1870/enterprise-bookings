import { Booking, EventType, User } from "@repo/shared-types";

import type { CollectionSlug, FieldHook } from "payload";

import type { BookingCollectionSlugs } from "../resolve-slugs";
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";

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

const isTimeslotClosed = (
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

  // If timeslot has already started, it's closed
  if (currentTime.getTime() >= startTimeMs) {
    return true;
  }

  // If lockOutTime is not defined or is null, only check if timeslot has started
  if (lockOutTime === undefined || lockOutTime === null) {
    return false;
  }

  // If lockOutTime is 0, only check if timeslot has started (already checked above)
  if (lockOutTime === 0) {
    return false;
  }

  // Check if we're past the lock-out deadline
  const lockOutDeadline = startTimeMs - lockOutTime * MILLISECONDS_PER_MINUTE;
  return currentTime.getTime() >= lockOutDeadline;
};

const _getConfirmedBookingsCount = (bookings: Booking[]): number => {
  return bookings.filter((booking) => booking.status === "confirmed").length;
};

const _hasUserConfirmedBooking = (
  bookings: Booking[],
  userId: number
): boolean => {
  return bookings.some(
    (booking) =>
      getUserFromBooking(booking).id === userId &&
      booking.status === "confirmed"
  );
};

const _hasUserWaitingBooking = (
  bookings: Booking[],
  userId: number
): boolean => {
  return bookings.some(
    (booking) =>
      getUserFromBooking(booking).id === userId && booking.status === "waiting"
  );
};

const _hasParentConfirmedBooking = (
  bookings: Booking[],
  parentId: number
): boolean => {
  return bookings.some((booking) => {
    const user = getUserFromBooking(booking);
    const bookingParentId = getParentId(user);
    return bookingParentId === parentId && booking.status === "confirmed";
  });
};

const isTrialable = (eventType: EventType): boolean => {
  return (
    eventType.paymentMethods?.allowedDropIn?.discountTiers?.some(
      (tier) => tier.type === "trial"
    ) ?? false
  );
};

export function createGetBookingStatus(slugs: BookingCollectionSlugs): FieldHook {
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;
  const bookingsSlug = slugs.bookings as CollectionSlug;

  return async ({ req, data, context }) => {
  if (context.triggerAfterChange === false) {
    return;
  }

  if (!data?.id || !data?.eventType) {
    return "active";
  }

  const currentTime = new Date();
  const userId = getUserId(req.user);

  try {
    const eventType = (await req.payload.findByID({
      collection: eventTypesSlug,
      id: data.eventType,
    })) as unknown as EventType;

    if (!eventType) {
      return "active";
    }

    // Compute capacity cheaply (avoid loading all bookings + deep relationships).
    // We bypass access control here because this is an internal derived field.
    const confirmedCountResult = await req.payload.find({
      collection: bookingsSlug,
      depth: 0,
      limit: 0,
      overrideAccess: true,
      where: {
        and: [
          { timeslot: { equals: data.id } },
          { status: { equals: "confirmed" } },
        ],
      },
      context: {
        triggerAfterChange: false,
      },
    });

    const confirmedCount =
      typeof (confirmedCountResult as any)?.totalDocs === "number"
        ? (confirmedCountResult as any).totalDocs
        : (confirmedCountResult.docs as any[]).length;

    const isFull = confirmedCount >= eventType.places;
    const trialable = isTrialable(eventType);

    if (isTimeslotClosed(data.startTime, undefined, currentTime)) {
      return "closed";
    }

    // Check children bookings (only for child classes) - check this first
    if (eventType.type === "child" && userId) {
      const parentConfirmed = await req.payload.find({
        collection: bookingsSlug,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          and: [
            { timeslot: { equals: data.id } },
            { "user.parentUser": { equals: userId } },
            { status: { equals: "confirmed" } },
          ],
        },
        context: { triggerAfterChange: false },
      });

      if (parentConfirmed.docs.length > 0) {
        return "childrenBooked";
      }
    }

    // Check if user already has confirmed bookings for this timeslot
    if (userId) {
      const userConfirmed = await req.payload.find({
        collection: bookingsSlug,
        depth: 0,
        limit: 2,
        overrideAccess: true,
        where: {
          and: [
            { timeslot: { equals: data.id } },
            { user: { equals: userId } },
            { status: { equals: "confirmed" } },
          ],
        },
        context: { triggerAfterChange: false },
      });

      if (userConfirmed.docs.length >= 2) return "multipleBooked";
      if (userConfirmed.docs.length === 1) return "booked";
    }

    // Check if user is on waiting list
    if (userId && isFull) {
      const userWaiting = await req.payload.find({
        collection: bookingsSlug,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          and: [
            { timeslot: { equals: data.id } },
            { user: { equals: userId } },
            { status: { equals: "waiting" } },
          ],
        },
        context: { triggerAfterChange: false },
      });

      if (userWaiting.docs.length > 0) {
        return "waiting";
      }
    }

    // Check if timeslot is closed (lock-out time) - check after user booking status
    if (isTimeslotClosed(data.startTime, data.lockOutTime, currentTime)) {
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
        collection: bookingsSlug,
        depth: 1,
        limit: 1,
        where: {
          and: [
            eventType.type === "child"
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
    console.error("Error calculating booking status:", error);
    return "active";
  }
  };
}

export const getBookingStatus = createGetBookingStatus(
  DEFAULT_BOOKING_COLLECTION_SLUGS,
);

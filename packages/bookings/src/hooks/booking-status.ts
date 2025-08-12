import { Booking, ClassOption, User } from "@repo/shared-types";

import { FieldHook } from "payload";

export const getBookingStatus: FieldHook = async ({ req, data, context }) => {
  if (context.triggerAfterChange === false) {
    return;
  }

  const classOption = (await req.payload.findByID({
    collection: "class-options",
    id: data?.classOption,
  })) as unknown as ClassOption;

  const trialable =
    classOption.paymentMethods?.allowedDropIn?.discountTiers?.some(
      (tier) => tier.type === "trial"
    );

  const currentTime = new Date();

  const bookingQuery = await req.payload.find({
    collection: "bookings",
    depth: 3,
    where: {
      lesson: {
        equals: data?.id,
      },
    },
    context: {
      // set a flag to prevent from running again
      triggerAfterChange: false,
    },
  });

  const bookings = bookingQuery.docs as unknown as Booking[];

  if (
    classOption.type === "child" &&
    bookings.some((booking: Booking) => {
      const parentId =
        typeof booking.user.parent === "object" && booking.user.parent !== null
          ? (booking.user.parent as unknown as User).id
          : (booking.user.parent as unknown as User);

      const userId = typeof req.user === "object" ? req.user?.id : req.user;

      return parentId === userId && booking.status === "confirmed";
    })
  ) {
    return "childrenBooked";
  }

  // Check if the lesson is closed based on lock-out time
  if (
    new Date(data?.startTime).getTime() - data?.lockOutTime * 60000 <=
    currentTime.getTime()
  ) {
    return "closed";
  }

  // Check if user is defined and if there are bookings for the user
  if (
    req.user &&
    bookings.some(
      (booking: Booking) =>
        (booking.user as unknown as User).id ===
          (req.user as unknown as User).id && booking.status === "confirmed"
    )
  ) {
    return "booked";
  }

  if (
    req.user &&
    bookings.some(
      (booking: Booking) =>
        (booking.user as unknown as User).id ===
          (req.user as unknown as User).id && booking.status === "waiting"
    ) &&
    bookings.filter((booking: Booking) => booking.status === "confirmed")
      .length >= classOption.places
  ) {
    return "waiting";
  }

  // TODO implement waitlist
  if (
    bookings.filter((booking: Booking) => booking.status === "confirmed")
      .length >= classOption.places
  ) {
    return "waitlist";
  }

  if (trialable) {
    if (!req.user) {
      return "trialable";
    } else {
      // For child classes, check if the parent has made any bookings
      if (classOption.type === "child") {
        // Check if the current user (parent) has made any confirmed bookings
        const parentBooking = await req.payload.find({
          collection: "bookings",
          depth: 1,
          limit: 1,
          where: {
            "user.parent": {
              equals: req.user.id,
            },
            status: {
              equals: "confirmed",
            },
          },
          context: {
            // set a flag to prevent from running again
            triggerAfterChange: false,
          },
        });

        // If parent has bookings, return active; otherwise trialable
        if (parentBooking.docs.length > 0) {
          return "active";
        } else {
          return "trialable";
        }
      } else {
        // For non-child classes, use the existing logic
        const userBooking = await req.payload.find({
          collection: "bookings",
          depth: 1,
          limit: 1,
          where: {
            user: {
              equals: req.user.id,
            },
            status: {
              equals: "confirmed",
            },
          },
          context: {
            // set a flag to prevent from running again
            triggerAfterChange: false,
          },
        });

        // Ensure userBooking is checked correctly
        if (userBooking.docs.length > 0) {
          // Check if there are any bookings
          return "active";
        } else {
          return "trialable";
        }
      }
    }
  }
  return "active";
};

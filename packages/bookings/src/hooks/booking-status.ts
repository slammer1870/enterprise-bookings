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
    classOption.paymentMethods?.allowedDropIns?.discountTiers?.some(
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
      status: {
        equals: "confirmed",
      },
    },
    context: {
      // set a flag to prevent from running again
      triggerAfterChange: false,
    },
  });

  const bookings = bookingQuery.docs as unknown as Booking[];

  // Check if user is defined and if there are bookings for the user
  if (
    req.user &&
    bookings.some(
      (booking: Booking) =>
        (booking.user as unknown as User).id ===
        (req.user as unknown as User).id
    ) &&
    new Date(data?.startTime) >= currentTime
  ) {
    return "booked";
  }

  // Check if the lesson is closed based on lock-out time
  if (
    new Date(data?.startTime).getTime() - data?.lockOutTime * 60000 <=
    currentTime.getTime()
  ) {
    return "closed";
  }

  // TODO implement waitlist
  if (bookingQuery.totalDocs >= classOption.places) {
    return "waitlist";
  }

  if (trialable) {
    if (!req.user) {
      return "trialable";
    } else {
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
  return "active";
};

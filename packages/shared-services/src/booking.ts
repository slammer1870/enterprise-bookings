import { Booking } from "@repo/shared-types";
import { Payload } from "payload";

export const createBookingOrUpdateBooking = async (
  booking: Booking,
  payload: Payload
) => {
  const existingBooking = await payload.find({
    collection: "bookings",
    where: { id: { equals: booking.id } },
  });

  if (existingBooking.totalDocs > 0) {
    return payload.update({
      collection: "bookings",
      id: existingBooking.docs[0].id,
      data: booking,
    });
  }

  return await payload.create({
    collection: "bookings",
    data: booking,
  });
};

import { Booking } from "../../types";

import { BookingDetail } from "./booking-detail";
import { EditBooking } from "./edit-booking";

export const BookingList = ({ bookings }: { bookings: Booking[] }) => {
  if (!bookings || bookings.length === 0) return null;

  console.log("bookings", bookings);
  return (
    <div className="w-full">
      <h3 className="mb-4">Bookings</h3>
      <div className="flex flex-col gap-4">
        {bookings.map((booking: Booking) => (
          <div
            key={booking.id}
            className="grid grid-cols-[1fr_auto] items-center gap-2"
          >
            <BookingDetail booking={booking} />
            <EditBooking booking={booking} />
          </div>
        ))}
      </div>
    </div>
  );
};

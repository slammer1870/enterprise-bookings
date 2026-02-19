import { Booking } from "@repo/shared-types";

import { BookingDetail } from "./booking-detail";
import { EditBooking } from "./edit-booking";

const STATUS_ORDER: Record<Booking["status"], number> = {
  confirmed: 0,
  pending: 1,
  waiting: 2,
  cancelled: 3,
};

function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status];
    const orderB = STATUS_ORDER[b.status];
    if (orderA !== orderB) return orderA - orderB;
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });
}

export const BookingList = ({ bookings }: { bookings: Booking[] }) => {
  if (!bookings || bookings.length === 0) return null;

  const sorted = sortBookings(bookings);

  return (
    <div className="w-full">
      <h3 className="mb-4">Bookings</h3>
      <div className="flex flex-col gap-4">
        {sorted.map((booking: Booking) => (
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

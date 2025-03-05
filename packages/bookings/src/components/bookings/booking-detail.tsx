import { Booking } from "@repo/shared-types";

export const BookingDetail = ({ booking }: { booking: Booking }) => {
  return (
    <div
      className={` ${booking.status == "cancelled" && "text-gray-600 line-through"}`}
    >
      {booking.user.name ? `${booking.user.name}` : `${booking.user.email}`}
      <span className="ml-2 text-red-500">
        {booking.status == "pending" && "(Requires Payment)"}
      </span>
    </div>
  );
};

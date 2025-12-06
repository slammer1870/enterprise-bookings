import { Booking } from "@repo/shared-types";

export const BookingDetail = ({ booking }: { booking: Booking }) => {
  return (
    <div
      className={` ${booking.status == "cancelled" && "text-gray-600 dark:text-gray-400 line-through"}`}
    >
      {booking.user.name ? `${booking.user.name}` : `${booking.user.email}`}
      <span className="ml-2 text-red-500 dark:text-red-400">
        {booking.status == "pending" && "(Requires Payment)"}
        {booking.status == "waiting" && "(Waiting List)"}
      </span>
    </div>
  );
};

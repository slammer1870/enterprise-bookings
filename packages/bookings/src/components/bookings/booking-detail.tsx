import { Booking } from "../../types";

export const BookingDetail = ({ booking }: { booking: Booking }) => {
  return (
    <div
      className={` ${booking.status == "cancelled" && "text-gray-600 line-through"}`}
    >
      {typeof booking.user === "object" ? `${booking.user.name}` : ""}
      <span className="ml-2 text-red-500">
        {booking.status == "pending" && "(Requires Payment)"}
      </span>
    </div>
  );
};

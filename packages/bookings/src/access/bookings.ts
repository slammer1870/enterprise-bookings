import { AccessArgs, Where } from "payload";

import { Access } from "payload";
import { Booking } from "../types";

export const isAdminOrMember: Access = async ({
  req,
  id,
}: AccessArgs<Booking>) => {
  const { user, data } = req;

  const booking = await req.payload.find({
    collection: "bookings",
    limit: 1,
    depth: 4,
    where: id ? { id: { equals: id } } : (req.query.where as Where),
  });

  if (booking.docs.length === 0) return false;

  if (!user) return false;

  return true;
};

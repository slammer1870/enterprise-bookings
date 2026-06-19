import { APIError, type CollectionSlug, type Endpoint } from "payload";

import type { BookingCollectionSlugs } from "../resolve-slugs";
import {
  findBookingsForTimeslot,
  parseNumericId,
  resolveBookingsCollectionSlug,
} from "../utils/timeslot-booking-queries";

export function createTimeslotBookingsEndpoint(
  slugs: BookingCollectionSlugs,
): Endpoint {
  const timeslotsSlug = slugs.timeslots as CollectionSlug;

  return {
    path: "/:id/bookings",
    method: "get",
    handler: async (req) => {
      if (!req.user) {
        throw new APIError("Unauthorized", 401);
      }

      const timeslotId = parseNumericId(req.routeParams?.id);
      if (timeslotId == null) {
        throw new APIError("Timeslot id is required", 400);
      }

      const timeslot = await req.payload
        .findByID({
          collection: timeslotsSlug,
          id: timeslotId,
          depth: 0,
          overrideAccess: false,
          req,
        })
        .catch(() => null);

      if (!timeslot) {
        throw new APIError("Timeslot not found", 404);
      }

      const bookingsSlug = resolveBookingsCollectionSlug(req.payload, timeslotsSlug);

      const { docs, totalDocs } = await findBookingsForTimeslot(
        req.payload,
        bookingsSlug,
        timeslotId,
        req,
        { depth: 2, overrideAccess: true },
      );

      return Response.json({ docs, totalDocs });
    },
  };
}

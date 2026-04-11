import { Timeslot } from "@repo/shared-types";
import type { CollectionAfterChangeHook, CollectionSlug } from "payload";

import type { BookingCollectionSlugs } from "../resolve-slugs";
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";

export function createSetLockout(
  slugs: BookingCollectionSlugs,
): CollectionAfterChangeHook {
  const timeslotsSlug = slugs.timeslots as CollectionSlug;

  return async ({ req, doc, context }) => {
    if (context.triggerAfterChange === false) {
      return;
    }

    const bookingLike = doc as any;
    const timeslotRel = bookingLike?.timeslot;
    const status = bookingLike?.status;

    if (!timeslotRel || !status) {
      return;
    }

    const timeslotId = typeof timeslotRel === "object" ? timeslotRel.id : timeslotRel;

    if (!timeslotId) {
      return;
    }

    const confirmed = status === "confirmed";

    try {
      if (confirmed) {
        await req.payload.update({
          collection: timeslotsSlug,
          id: timeslotId,
          data: {
            lockOutTime: 0,
          },
          context: { triggerAfterChange: false },
        });
        return;
      }

      const timeslot = (await req.payload.findByID({
        collection: timeslotsSlug,
        id: timeslotId,
        depth: 2,
      })) as unknown as Timeslot;

      if (
        !timeslot.bookings?.docs
          ?.filter((booking) => booking.id != bookingLike.id)
          .some((booking) => booking.status === "confirmed")
      ) {
        await req.payload.update({
          collection: timeslotsSlug,
          id: timeslotId,
          data: {
            lockOutTime: timeslot.originalLockOutTime,
          },
          context: { triggerAfterChange: false },
        });
        return;
      }
    } catch (error: any) {
      if (error?.status === 404 || error?.name === "NotFound") {
        return;
      }
      throw error;
    }
  };
}

export const setLockout = createSetLockout(DEFAULT_BOOKING_COLLECTION_SLUGS);

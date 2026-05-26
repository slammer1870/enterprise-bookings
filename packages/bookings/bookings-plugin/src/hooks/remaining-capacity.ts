import type { CollectionSlug, FieldHook } from "payload";

import type { BookingCollectionSlugs } from "../resolve-slugs";
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";

export type RemainingCapacityOptions = {
  /** When `checkout-holds`, active holds reserve capacity instead of recent pending bookings. */
  reservedCapacityMode?: "recent-pending" | "checkout-holds";
  checkoutHoldCollection?: CollectionSlug;
};

export function createGetRemainingCapacity(
  slugs: BookingCollectionSlugs,
  options?: RemainingCapacityOptions,
): FieldHook {
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;
  const bookingsSlug = slugs.bookings as CollectionSlug;
  const holdCollection =
    options?.checkoutHoldCollection ?? ("booking-checkout-holds" as CollectionSlug);
  const useCheckoutHolds = options?.reservedCapacityMode === "checkout-holds";

  return async ({ req, data, context }) => {
    if (context.triggerAfterChange === false) {
      return;
    }

    if (!data?.eventType) {
      return 0;
    }

    try {
      const eventTypeId =
        typeof data.eventType === "object" && data.eventType !== null
          ? data.eventType.id
          : data.eventType;

      if (!eventTypeId) {
        return 0;
      }

      const eventType = (await req.payload.findByID({
        collection: eventTypesSlug,
        id: eventTypeId,
        depth: 1,
        context: {
          triggerAfterChange: false,
        },
      })) as { places?: number } | null;

      if (!eventType) {
        return 0;
      }

      const places = typeof eventType.places === "number" ? eventType.places : 0;

      if (!data?.id) {
        return places;
      }

      if (useCheckoutHolds) {
        const [confirmedResult, holdsResult] = await Promise.all([
          req.payload.find({
            collection: bookingsSlug,
            depth: 0,
            where: {
              and: [
                { timeslot: { equals: data.id } },
                { status: { equals: "confirmed" } },
              ],
            },
            limit: 0,
            context: {
              triggerAfterChange: false,
            },
          }),
          req.payload.find({
            collection: holdCollection,
            depth: 0,
            where: {
              and: [
                { timeslot: { equals: data.id } },
                { status: { equals: "active" } },
                { expiresAt: { greater_than: new Date().toISOString() } },
              ],
            },
            limit: 100,
            context: {
              triggerAfterChange: false,
            },
          }),
        ]);

        const confirmed = confirmedResult.totalDocs ?? 0;
        const held = (holdsResult.docs ?? []).reduce((sum, doc) => {
          const qty = (doc as { quantity?: number }).quantity;
          return sum + (typeof qty === "number" ? qty : 0);
        }, 0);

        return places - confirmed - held;
      }

      const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const bookings = await req.payload.find({
        collection: bookingsSlug,
        depth: 1,
        where: {
          and: [
            { timeslot: { equals: data.id } },
            {
              or: [
                { status: { equals: "confirmed" } },
                {
                  and: [
                    { status: { equals: "pending" } },
                    { createdAt: { greater_than: pendingCutoff } },
                  ],
                },
              ],
            },
          ],
        },
        limit: 0,
        context: {
          triggerAfterChange: false,
        },
      });

      const remaining = places - bookings.totalDocs;

      return remaining;
    } catch (error: any) {
      if (
        error?.status === 404 ||
        error?.name === "NotFound" ||
        error?.message?.includes("Cannot read properties of undefined")
      ) {
        return 0;
      }
      throw error;
    }
  };
}

/** @deprecated Prefer createGetRemainingCapacity(slugs) for custom slugs. */
export const getRemainingCapacity = createGetRemainingCapacity(
  DEFAULT_BOOKING_COLLECTION_SLUGS,
);

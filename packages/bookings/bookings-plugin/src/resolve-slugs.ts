/**
 * Resolved collection slugs for the bookings plugin.
 * Defaults use the canonical booking domain names.
 */
export type BookingCollectionSlugs = {
  timeslots: string;
  eventTypes: string;
  staffMembers: string;
  bookings: string;
};

export const DEFAULT_BOOKING_COLLECTION_SLUGS: BookingCollectionSlugs = {
  timeslots: "timeslots",
  eventTypes: "event-types",
  staffMembers: "staff-members",
  bookings: "bookings",
};

export function resolveBookingCollectionSlugs(config: {
  slugs?: Partial<BookingCollectionSlugs>;
}): BookingCollectionSlugs {
  return {
    timeslots:
      config.slugs?.timeslots ?? DEFAULT_BOOKING_COLLECTION_SLUGS.timeslots,
    eventTypes:
      config.slugs?.eventTypes ?? DEFAULT_BOOKING_COLLECTION_SLUGS.eventTypes,
    staffMembers:
      config.slugs?.staffMembers ?? DEFAULT_BOOKING_COLLECTION_SLUGS.staffMembers,
    bookings: config.slugs?.bookings ?? DEFAULT_BOOKING_COLLECTION_SLUGS.bookings,
  };
}

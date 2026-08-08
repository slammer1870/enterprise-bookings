/**
 * Resolved collection slugs for the bookings plugin.
 * Defaults use the canonical booking domain names.
 * Staff on timeslots/scheduler relates to `users` (no separate staff-members collection).
 */
export type BookingCollectionSlugs = {
  timeslots: string;
  eventTypes: string;
  bookings: string;
  /**
   * @deprecated Staff members collection removed; timeslot.staffMember → users.
   * Kept optional for older callers; ignored by the plugin.
   */
  staffMembers?: string;
};

export const DEFAULT_BOOKING_COLLECTION_SLUGS: BookingCollectionSlugs = {
  timeslots: "timeslots",
  eventTypes: "event-types",
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
    bookings: config.slugs?.bookings ?? DEFAULT_BOOKING_COLLECTION_SLUGS.bookings,
  };
}

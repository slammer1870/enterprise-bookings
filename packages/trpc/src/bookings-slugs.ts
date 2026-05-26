/**
 * Booking-related Payload collection slugs for tRPC.
 * Defaults match @repo/bookings-plugin; apps can override via createTRPCContext.
 */
export type TRPCBookingCollectionSlugs = {
  timeslots: string;
  eventTypes: string;
  staffMembers: string;
  bookings: string;
  classPasses: string;
  classPassTypes: string;
};

export const DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS: TRPCBookingCollectionSlugs = {
  timeslots: "timeslots",
  eventTypes: "event-types",
  staffMembers: "staff-members",
  bookings: "bookings",
  classPasses: "class-passes",
  classPassTypes: "class-pass-types",
};

export function mergeTRPCBookingCollectionSlugs(
  partial?: Partial<TRPCBookingCollectionSlugs>
): TRPCBookingCollectionSlugs {
  return {
    ...DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS,
    ...partial,
  };
}

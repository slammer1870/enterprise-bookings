/**
 * Booking-related Payload collection slugs for tRPC.
 * Defaults matches @repo/bookings-plugin; apps can override via createTRPCContext.
 */
export type TRPCBookingCollectionSlugs = {
  timeslots: string;
  eventTypes: string;
  staffMembers: string;
  bookings: string;
  classPasses: string;
  classPassTypes: string;
  courseEnrollments: string;
  courses: string;
};

export const DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS: TRPCBookingCollectionSlugs = {
  timeslots: "timeslots",
  eventTypes: "event-types",
  /** Timeslot staffMember relates to users. */
  staffMembers: "users",
  bookings: "bookings",
  classPasses: "class-passes",
  classPassTypes: "class-pass-types",
  courseEnrollments: "course-enrollments",
  courses: "courses",
};

export function mergeTRPCBookingCollectionSlugs(
  partial?: Partial<TRPCBookingCollectionSlugs>
): TRPCBookingCollectionSlugs {
  return {
    ...DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS,
    ...partial,
  };
}

/**
 * Booking-related Payload collection slugs for tRPC.
 * Defaults match @repo/bookings-plugin; apps can override via createTRPCContext.
 */
export type TRPCBookingsCollectionSlugs = {
  lessons: string;
  classOptions: string;
  instructors: string;
  bookings: string;
};

export const DEFAULT_TRPC_BOOKINGS_COLLECTION_SLUGS: TRPCBookingsCollectionSlugs = {
  lessons: "lessons",
  classOptions: "class-options",
  instructors: "instructors",
  bookings: "bookings",
};

export function mergeTRPCBookingsSlugs(
  partial?: Partial<TRPCBookingsCollectionSlugs>
): TRPCBookingsCollectionSlugs {
  return {
    ...DEFAULT_TRPC_BOOKINGS_COLLECTION_SLUGS,
    ...partial,
  };
}

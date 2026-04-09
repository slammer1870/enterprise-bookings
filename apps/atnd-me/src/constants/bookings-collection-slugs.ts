import type { BookingCollectionSlugs } from '@repo/bookings-plugin'
import type { TRPCBookingCollectionSlugs } from '@repo/trpc'

/**
 * Payload collection slugs for the booking domain on atnd-me.
 * Pass to bookingsPlugin({ slugs }), createTRPCContext({ bookingsCollectionSlugs }), and Local API.
 */
export const ATND_ME_BOOKINGS_COLLECTION_SLUGS = {
  timeslots: 'timeslots',
  eventTypes: 'event-types',
  staffMembers: 'staff-members',
  bookings: 'bookings',
} as const satisfies BookingCollectionSlugs & TRPCBookingCollectionSlugs

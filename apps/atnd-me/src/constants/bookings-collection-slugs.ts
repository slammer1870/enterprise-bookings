import type { BookingsPluginSlugs } from '@repo/bookings-plugin'
import type { TRPCBookingsCollectionSlugs } from '@repo/trpc'

/**
 * Payload collection slugs for the booking domain on atnd-me.
 * Pass to bookingsPlugin({ slugs }), createTRPCContext({ bookingsCollectionSlugs }), and Local API.
 */
export const ATND_ME_BOOKINGS_COLLECTION_SLUGS = {
  lessons: 'timeslots',
  classOptions: 'event-types',
  instructors: 'staff-members',
  bookings: 'bookings',
} as const satisfies BookingsPluginSlugs & TRPCBookingsCollectionSlugs

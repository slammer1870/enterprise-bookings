export { bookingsPlugin } from "./plugin";
export type { BookingsPluginConfig } from "./types";
export {
  bookingCreateAccess,
  bookingUpdateAccess,
  createBookingAccess,
} from "./access/bookings";
export { generateTimeslotsFromSchedule } from "./tasks/generate-timeslots";
// Export from .ts handler so Node/Vite never resolves via `generate-timeslots.js` (which omits the factory).
export { createGenerateTimeslotsFromScheduleHandler } from "./tasks/create-generate-timeslots-handler";
export {
  resolveBookingCollectionSlugs,
  DEFAULT_BOOKING_COLLECTION_SLUGS,
} from "./resolve-slugs";
export type { BookingCollectionSlugs } from "./resolve-slugs";

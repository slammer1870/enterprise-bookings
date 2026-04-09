export { bookingsPlugin } from "./plugin";
export type { BookingsPluginConfig } from "./types";
export {
  bookingCreateAccess,
  bookingUpdateAccess,
  createBookingAccess,
} from "./access/bookings";
export { generateLessonsFromSchedule } from "./tasks/generate-lessons";
// Export from .ts handler so Node/Vite never resolves via `generate-lessons.js` (which omits the factory).
export { createGenerateLessonsFromScheduleHandler } from "./tasks/create-generate-lessons-handler";
export {
  resolveBookingsPluginSlugs,
  DEFAULT_BOOKINGS_PLUGIN_SLUGS,
} from "./resolve-slugs";
export type { BookingsPluginSlugs } from "./resolve-slugs";

import { DEFAULT_BOOKINGS_PLUGIN_SLUGS } from "../resolve-slugs";

export { createGenerateLessonsFromScheduleHandler } from "./create-generate-lessons-handler";

import { createGenerateLessonsFromScheduleHandler } from "./create-generate-lessons-handler";

export const generateLessonsFromSchedule =
  createGenerateLessonsFromScheduleHandler(DEFAULT_BOOKINGS_PLUGIN_SLUGS);

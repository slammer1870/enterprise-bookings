import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";

export { createGenerateTimeslotsFromScheduleHandler } from "./create-generate-timeslots-handler";

import { createGenerateTimeslotsFromScheduleHandler } from "./create-generate-timeslots-handler";

export const generateTimeslotsFromSchedule =
  createGenerateTimeslotsFromScheduleHandler(DEFAULT_BOOKING_COLLECTION_SLUGS);

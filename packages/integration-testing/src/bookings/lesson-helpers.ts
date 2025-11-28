import type { Payload } from "payload";

/**
 * Creates a date object set to the start of the specified date (midnight)
 */
const getStartOfDay = (date: Date): Date => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
};

/**
 * Gets a date that's valid for subscriptions to cover lessons created today
 * Returns the start of yesterday to ensure it covers all lessons today
 */
export const getSubscriptionStartDate = (): Date => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getStartOfDay(yesterday);
};

/**
 * Creates a date object with the specified time on the specified date
 * Ensures hours stay within 0-23 to prevent crossing midnight
 */
const createDateTimeOnDate = (
  date: Date,
  hours: number,
  minutes: number = 0
): Date => {
  const dateTime = new Date(date);
  // Clamp hours to 0-23 to ensure we stay on the same day
  const clampedHours = Math.max(0, Math.min(23, Math.floor(hours)));
  const clampedMinutes = Math.max(0, Math.min(59, Math.floor(minutes)));
  dateTime.setHours(clampedHours, clampedMinutes, 0, 0);
  return dateTime;
};

/**
 * Checks if two time ranges overlap
 */
const doTimeRangesOverlap = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean => {
  return start1 < end2 && start2 < end1;
};

/**
 * Creates lesson data ensuring:
 * - All dates (date, startTime, endTime) are on the same day
 * - endTime is always after startTime
 * - startTime is always in the future (greater than now)
 * - lockOutTime is set appropriately to keep lessons active
 * - No overlapping lessons exist for the same location
 */
export const createLessonData = async (
  payload: Payload,
  options: {
    baseDate?: Date;
    startHoursOffset?: number; // Hours from midnight of baseDate
    durationHours?: number; // Duration of lesson in hours
    classOption: number | string;
    location?: string | null;
    lockOutTime?: number; // Minutes before lesson start when it closes
    instructor?: number | string | null;
  }
): Promise<{
  date: Date;
  startTime: Date;
  endTime: Date;
  classOption: number | string;
  location?: string | null;
  lockOutTime: number; // Always return a number
  instructor?: number | string | null;
}> => {
  const {
    baseDate = new Date(),
    startHoursOffset = 10, // Default to 10 AM
    durationHours = 1, // Default to 1 hour duration
    classOption,
    location = "Test Location",
    lockOutTime,
    instructor,
  } = options;

  // Default lockOutTime to 60 minutes (1 hour) if not provided
  // This ensures lessons remain active for testing
  const defaultLockOutTime = 60; // 60 minutes = 1 hour
  const finalLockOutTime = lockOutTime ?? defaultLockOutTime;

  // Get the start of the day for the base date
  let lessonDate = getStartOfDay(baseDate);

  // Calculate start and end times on the same day
  // Clamp start hours to 0-23
  const startHours = Math.max(0, Math.min(23, Math.floor(startHoursOffset)));
  
  // Calculate end hours, but ensure it doesn't exceed 23:59
  const requestedEndHours = startHours + durationHours;
  if (requestedEndHours > 24) {
    throw new Error(
      `Lesson duration would extend past midnight. Start: ${startHours}:00, Duration: ${durationHours} hours. Maximum duration: ${24 - startHours} hours.`
    );
  }
  
  let startTime = createDateTimeOnDate(lessonDate, startHours, 0);
  
  // Ensure startTime is in the future and accounts for lockOutTime
  // Lesson closes at: startTime - (lockOutTime * 60000) milliseconds
  // We want: startTime - (lockOutTime * 60000) > now
  // So: startTime > now + (lockOutTime * 60000)
  const now = new Date();
  const lockOutTimeMs = finalLockOutTime * 60 * 1000; // Convert minutes to milliseconds
  const minimumStartTime = new Date(now.getTime() + lockOutTimeMs + 60000); // Add 1 minute buffer

  // If the calculated startTime is in the past or too close to now, move to tomorrow
  if (startTime <= minimumStartTime) {
    lessonDate = new Date(lessonDate);
    lessonDate.setDate(lessonDate.getDate() + 1);
    startTime = createDateTimeOnDate(lessonDate, startHours, 0);
    
    // Double-check it's still in the future
    if (startTime <= minimumStartTime) {
      // If still too close, add another day
      lessonDate.setDate(lessonDate.getDate() + 1);
      startTime = createDateTimeOnDate(lessonDate, startHours, 0);
    }
  }
  
  // If end time would be at or after midnight, set to 23:59
  let endTime: Date;
  if (requestedEndHours >= 24) {
    endTime = createDateTimeOnDate(lessonDate, 23, 59);
  } else {
    endTime = createDateTimeOnDate(lessonDate, requestedEndHours, 0);
  }

  // Ensure endTime is after startTime (should always be true, but safety check)
  if (endTime <= startTime) {
    throw new Error(
      `End time must be after start time. Start: ${startTime.toISOString()}, End: ${endTime.toISOString()}`
    );
  }

  // Check for overlapping lessons at the same location
  // Two time ranges overlap if: start1 < end2 AND start2 < end1
  // We need to check if any existing lesson overlaps with the new lesson
  const existingLessons = await payload.find({
    collection: "lessons",
    where: {
      and: [
        {
          location: {
            equals: location,
          },
        },
        {
          // Existing lesson starts before new lesson ends
          startTime: {
            less_than: endTime.toISOString(),
          },
        },
        {
          // Existing lesson ends after new lesson starts
          endTime: {
            greater_than: startTime.toISOString(),
          },
        },
      ],
    },
    limit: 1,
  });

  if (existingLessons.docs.length > 0) {
    const existing = existingLessons.docs[0];
    throw new Error(
      `Lesson overlaps with existing lesson (ID: ${existing.id}) at location "${location}". ` +
        `Existing: ${existing.startTime} - ${existing.endTime}, ` +
        `New: ${startTime.toISOString()} - ${endTime.toISOString()}`
    );
  }

  return {
    date: lessonDate,
    startTime,
    endTime,
    classOption,
    location,
    lockOutTime: finalLockOutTime,
    instructor,
  };
};

/**
 * Helper to create a lesson with automatic overlap checking and date normalization
 */
export const createLesson = async (
  payload: Payload,
  options: {
    baseDate?: Date;
    startHoursOffset?: number;
    durationHours?: number;
    classOption: number | string;
    location?: string | null;
    lockOutTime?: number;
    instructor?: number | string | null;
  }
) => {
  const lessonData = await createLessonData(payload, options);

  return payload.create({
    collection: "lessons",
    data: {
      date: lessonData.date,
      startTime: lessonData.startTime,
      endTime: lessonData.endTime,
      classOption: lessonData.classOption,
      location: lessonData.location,
      lockOutTime: lessonData.lockOutTime,
      instructor: lessonData.instructor,
    },
  });
};


import { startOfWeek, addDays, getDay } from "date-fns";

/**
 * Calendar event interface for react-big-calendar
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    dayIndex: number;
    slotIndex: number;
    slotData: TimeSlotData;
  };
}

/**
 * Time slot data structure matching the scheduler's timeSlot field
 */
export interface TimeSlotData {
  id?: string;
  startTime: string | Date;
  endTime: string | Date;
  classOption?: number | { id: number; name?: string };
  location?: string;
  instructor?: number | { id: number; email?: string; name?: string };
  lockOutTime?: number;
}

/**
 * Day data structure matching the scheduler's week.days structure
 */
export interface DayData {
  id?: string;
  timeSlot?: TimeSlotData[];
}

/**
 * Week data structure matching the scheduler's week structure
 */
export interface WeekData {
  days?: DayData[];
}

/**
 * Days of week mapping (Monday = 0, Sunday = 6)
 */
const DAYS_OF_WEEK: readonly string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * Get the day index (0-6) from a day name
 */
export function getDayIndex(dayName: string): number {
  return DAYS_OF_WEEK.indexOf(dayName);
}

/**
 * Convert scheduler week data to calendar events
 * @param weekData - The week data from the scheduler
 * @param referenceDate - A reference date to use for creating the calendar week (defaults to current week)
 * @returns Array of calendar events
 */
export function schedulerToCalendarEvents(
  weekData: WeekData | null | undefined,
  referenceDate: Date = new Date(),
): CalendarEvent[] {
  if (!weekData?.days || !Array.isArray(weekData.days)) {
    return [];
  }

  const events: CalendarEvent[] = [];
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Start week on Monday

  weekData.days.forEach((day, dayIndex) => {
    if (!day.timeSlot || !Array.isArray(day.timeSlot)) {
      return;
    }

    day.timeSlot.forEach((slot, slotIndex) => {
      if (!slot.startTime || !slot.endTime) {
        return;
      }

      // Get the date for this day of the week
      const dayDate = addDays(weekStart, dayIndex);

      // Parse start and end times
      const startTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);

      // Set the date to match the day of the week
      const startDate = new Date(dayDate);
      startDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

      const endDate = new Date(dayDate);
      endDate.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

      // Create a title for the event
      const classOptionName =
        typeof slot.classOption === "object" && slot.classOption?.name
          ? slot.classOption.name
          : slot.classOption
            ? `Class ${slot.classOption}`
            : "Lesson";

      const locationText = slot.location ? ` - ${slot.location}` : "";
      const title = `${classOptionName}${locationText}`;

      events.push({
        id: slot.id || `day-${dayIndex}-slot-${slotIndex}`,
        title,
        start: startDate,
        end: endDate,
        resource: {
          dayIndex,
          slotIndex,
          slotData: slot,
        },
      });
    });
  });

  return events;
}

/**
 * Convert calendar event back to scheduler time slot data
 * @param event - The calendar event
 * @returns Time slot data
 */
export function calendarEventToTimeSlot(event: CalendarEvent): TimeSlotData {
  // Ensure Date objects are properly formatted
  const startTime = event.start instanceof Date ? event.start : new Date(event.start);
  const endTime = event.end instanceof Date ? event.end : new Date(event.end);

  return {
    ...event.resource.slotData,
    startTime,
    endTime,
  };
}

/**
 * Convert calendar events back to scheduler week structure
 * @param events - Array of calendar events
 * @param existingWeekData - Optional existing week data to preserve IDs and structure
 * @returns Week data structure
 */
export function calendarEventsToScheduler(
  events: CalendarEvent[],
  existingWeekData?: WeekData | null,
): WeekData {
  // Initialize days array - preserve existing structure if available, otherwise create new
  // Always ensure we have exactly 7 days
  const existingDays = existingWeekData?.days || [];
  const days: DayData[] = Array.from({ length: 7 }, (_, index) => {
    const existingDay = existingDays[index];
    // Preserve existing day structure but ensure timeSlot exists
    if (existingDay) {
      return {
        ...existingDay,
        timeSlot: existingDay.timeSlot || [],
      };
    }
    return {
      id: undefined,
      timeSlot: [],
    };
  });

  // Clear time slots for all days first, then repopulate from events
  // But preserve day IDs from existing structure
  days.forEach((day, index) => {
    const existingDay = existingDays[index];
    if (existingDay?.id) {
      day.id = existingDay.id;
    }
    day.timeSlot = [];
  });

  events.forEach((event) => {
    const dayIndex = event.resource.dayIndex;
    if (dayIndex >= 0 && dayIndex < 7) {
      const day = days[dayIndex];
      if (day) {
        if (!day.timeSlot) {
          day.timeSlot = [];
        }

        const timeSlot = calendarEventToTimeSlot(event);

        // Preserve existing slot ID if it exists and matches
        const existingDay = existingDays[dayIndex];
        if (existingDay?.timeSlot) {
          const existingSlot = existingDay.timeSlot.find((s: TimeSlotData) => s.id === event.id);
          if (existingSlot && existingSlot.id) {
            timeSlot.id = existingSlot.id;
          }
        }

        day.timeSlot.push(timeSlot);
      }
    }
  });

  // Sort time slots within each day by start time
  days.forEach((day) => {
    if (day.timeSlot && day.timeSlot.length > 0) {
      day.timeSlot.sort((a, b) => {
        const aStart = new Date(a.startTime).getTime();
        const bStart = new Date(b.startTime).getTime();
        return aStart - bStart;
      });
    }
    // Ensure timeSlot is always an array, never undefined
    if (!day.timeSlot) {
      day.timeSlot = [];
    }
  });

  // Final validation: ensure we always have exactly 7 days with timeSlot arrays
  days.forEach((day) => {
    if (!day.timeSlot) {
      day.timeSlot = [];
    }
  });

  return { days };
}

/**
 * Create a new time slot from a date range (for creating new slots)
 */
export function createNewTimeSlotEvent(start: Date, end: Date, dayIndex: number): CalendarEvent {
  return {
    id: `new-${Date.now()}`,
    title: "New Lesson",
    start,
    end,
    resource: {
      dayIndex,
      slotIndex: -1,
      slotData: {
        startTime: start,
        endTime: end,
      },
    },
  };
}

/**
 * Check if two time slots overlap
 */
export function slotsOverlap(
  slot1: { startTime: Date | string; endTime: Date | string },
  slot2: { startTime: Date | string; endTime: Date | string },
  location1?: string,
  location2?: string,
): boolean {
  // If locations are provided and different, no overlap
  if (location1 && location2 && location1 !== location2) {
    return false;
  }

  const start1 = new Date(slot1.startTime).getTime();
  const end1 = new Date(slot1.endTime).getTime();
  const start2 = new Date(slot2.startTime).getTime();
  const end2 = new Date(slot2.endTime).getTime();

  // Two time periods overlap if: start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Validate that a new/updated slot doesn't conflict with existing slots
 */
export function validateSlotConflict(
  newSlot: TimeSlotData,
  existingSlots: TimeSlotData[],
  excludeSlotId?: string,
): string | null {
  for (const existingSlot of existingSlots) {
    // Skip the slot being edited
    if (excludeSlotId && existingSlot.id === excludeSlotId) {
      continue;
    }

    if (slotsOverlap(newSlot, existingSlot, newSlot.location, existingSlot.location)) {
      const start1 = new Date(newSlot.startTime);
      const end1 = new Date(newSlot.endTime);
      const start2 = new Date(existingSlot.startTime);
      const end2 = new Date(existingSlot.endTime);

      return `Time slot conflict: ${start1.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })}-${end1.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })} and ${start2.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })}-${end2.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })} overlap${newSlot.location ? ` at location "${newSlot.location}"` : ""}`;
    }
  }

  return null;
}

/**
 * Get day index from a date (0 = Monday, 6 = Sunday)
 */
export function getDayIndexFromDate(date: Date): number {
  const day = getDay(date); // 0 = Sunday, 1 = Monday, etc.
  return day === 0 ? 6 : day - 1; // Convert to Monday = 0
}


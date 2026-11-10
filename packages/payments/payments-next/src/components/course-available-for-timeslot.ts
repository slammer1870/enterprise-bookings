/**
 * A course is available as a booking payment option only when someone can
 * still enroll and that enrollment would cover this timeslot.
 * A linked draft, closed, archived, or out-of-window course is not available.
 */

type CourseForAvailability = {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  durationLength?: number | null;
  durationUnit?: string | null;
  priceInformation?: { price?: number | null } | null;
  allowedEventTypes?: Array<number | { id?: number | null } | null> | null;
};

function relationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === "object" && "id" in value) {
    return relationId((value as { id: unknown }).id);
  }
  return null;
}

function dayKey(value: string): string {
  return value.trim().slice(0, 10);
}

function startOfUtcDay(dateOnly: string): number {
  return Date.parse(`${dayKey(dateOnly)}T00:00:00.000Z`);
}

function endOfUtcDay(dateOnly: string): number {
  return Date.parse(`${dayKey(dateOnly)}T23:59:59.999Z`);
}

function courseAllowsEventType(course: CourseForAvailability, eventTypeId: number | null): boolean {
  if (!Array.isArray(course.allowedEventTypes)) return false;
  if (eventTypeId == null) return false;
  return course.allowedEventTypes.some((entry) => relationId(entry) === eventTypeId);
}

function enrollmentStillOpen(course: CourseForAvailability, now: Date): boolean {
  if (typeof course.startDate !== "string" || course.startDate.trim() === "") return true;
  return dayKey(course.startDate) >= now.toISOString().slice(0, 10);
}

function coversTimeslot(course: CourseForAvailability, slotStartMs: number, now: Date): boolean {
  const hasFixed =
    typeof course.startDate === "string" &&
    course.startDate.trim() !== "" &&
    typeof course.endDate === "string" &&
    course.endDate.trim() !== "";
  const durationLength = course.durationLength;
  const hasDuration =
    typeof durationLength === "number" &&
    Number.isFinite(durationLength) &&
    durationLength >= 1 &&
    (course.durationUnit === "days" || course.durationUnit === "weeks");

  if (hasFixed === hasDuration) return false;

  if (hasFixed) {
    const start = startOfUtcDay(course.startDate!);
    const end = endOfUtcDay(course.endDate!);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
    return slotStartMs >= start && slotStartMs <= end;
  }

  const days = course.durationUnit === "weeks" ? Math.floor(durationLength!) * 7 : Math.floor(durationLength!);
  const accessEnd = new Date(now);
  accessEnd.setUTCDate(accessEnd.getUTCDate() + days);
  return slotStartMs >= now.getTime() && slotStartMs <= accessEnd.getTime();
}

export function isCourseAvailableForTimeslot(args: {
  course: unknown;
  timeslotStart?: string | null;
  eventTypeId?: number | null;
  now?: Date;
}): boolean {
  const { course, timeslotStart, eventTypeId = null, now = new Date() } = args;
  if (!course || typeof course !== "object") return false;
  const doc = course as CourseForAvailability;
  if (doc.status !== "open") return false;
  if (!courseAllowsEventType(doc, eventTypeId)) return false;

  const price = doc.priceInformation?.price;
  if (typeof price !== "number" || !(price > 0)) return false;
  if (!enrollmentStillOpen(doc, now)) return false;

  const slotStartMs = typeof timeslotStart === "string" ? Date.parse(timeslotStart) : NaN;
  if (!Number.isFinite(slotStartMs)) return false;
  return coversTimeslot(doc, slotStartMs, now);
}

export function eventTypeIdFromTimeslot(eventType: unknown): number | null {
  if (typeof eventType === "number") return eventType;
  if (eventType && typeof eventType === "object" && "id" in eventType) {
    return relationId((eventType as { id: unknown }).id);
  }
  return null;
}

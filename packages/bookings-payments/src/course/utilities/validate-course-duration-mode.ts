import {
  resolveCourseDurationMode,
  type CourseAccessWindowInput,
} from "./compute-enrollment-access-window";

/** Payload-style validate: true or error message. */
export function validateCourseDurationMode(
  course: CourseAccessWindowInput,
): true | string {
  const mode = resolveCourseDurationMode(course);
  if (mode === "invalid") {
    const hasAnyDate =
      (typeof course.startDate === "string" && course.startDate.trim()) ||
      (typeof course.endDate === "string" && course.endDate.trim());
    const hasAnyDuration =
      course.durationLength != null || course.durationUnit != null;
    if (hasAnyDate && hasAnyDuration) {
      return "Set fixed dates or a duration, not both";
    }
    return "Set fixed dates (start + end) or a duration (length + unit)";
  }

  if (mode === "fixed") {
    const start = Date.parse(`${String(course.startDate).trim().slice(0, 10)}T00:00:00.000Z`);
    const end = Date.parse(`${String(course.endDate).trim().slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "startDate and endDate must be valid dates";
    }
    if (end < start) {
      return "endDate must be on or after startDate";
    }
  }

  return true;
}

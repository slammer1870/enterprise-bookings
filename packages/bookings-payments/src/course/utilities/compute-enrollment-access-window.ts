export type CourseDurationMode = "fixed" | "duration" | "invalid";

export type CourseAccessWindowInput = {
  startDate?: string | null;
  endDate?: string | null;
  durationLength?: number | null;
  durationUnit?: "days" | "weeks" | null;
};

export type EnrollmentAccessWindow = {
  accessStartsAt: string;
  accessEndsAt: string;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidDurationLength(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

function hasValidDurationUnit(value: unknown): value is "days" | "weeks" {
  return value === "days" || value === "weeks";
}

/** Exactly one of fixed dates or duration length — not mixed / not neither. */
export function resolveCourseDurationMode(
  course: CourseAccessWindowInput,
): CourseDurationMode {
  const hasFixed = hasText(course.startDate) && hasText(course.endDate);
  const hasDuration =
    hasValidDurationLength(course.durationLength) &&
    hasValidDurationUnit(course.durationUnit);

  if (hasFixed && hasDuration) return "invalid";
  if (hasFixed) return "fixed";
  if (hasDuration) return "duration";
  return "invalid";
}

function startOfUtcDay(dateOnly: string): string {
  const day = dateOnly.trim().slice(0, 10);
  return `${day}T00:00:00.000Z`;
}

function endOfUtcDay(dateOnly: string): string {
  const day = dateOnly.trim().slice(0, 10);
  return `${day}T23:59:59.999Z`;
}

/**
 * Stamp enrollment access window from course product mode + purchase time.
 * Fixed: product start/end (UTC day bounds). Duration: purchasedAt → +N days/weeks.
 */
export function computeEnrollmentAccessWindow(
  course: CourseAccessWindowInput,
  purchasedAt: Date,
): EnrollmentAccessWindow {
  const mode = resolveCourseDurationMode(course);
  if (mode === "invalid") {
    throw new Error("Invalid course duration mode: set fixed dates or duration, not both or neither");
  }

  if (mode === "fixed") {
    const start = startOfUtcDay(course.startDate!);
    const end = endOfUtcDay(course.endDate!);
    if (Date.parse(end) < Date.parse(start)) {
      throw new Error("Invalid course endDate: must be on or after startDate");
    }
    return { accessStartsAt: start, accessEndsAt: end };
  }

  const length = Math.floor(course.durationLength!);
  const days = course.durationUnit === "weeks" ? length * 7 : length;
  const accessStartsAt = purchasedAt.toISOString();
  const end = new Date(purchasedAt);
  end.setUTCDate(end.getUTCDate() + days);
  return { accessStartsAt, accessEndsAt: end.toISOString() };
}

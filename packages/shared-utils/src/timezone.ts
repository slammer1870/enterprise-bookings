import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

const DEFAULT_TIME_ZONE = "Europe/Dublin";

type TimeLike = Date | string;
type DateLike = Date | string | number;

type WallClockTime = {
  hours: number;
  minutes: number;
  seconds?: number;
  milliseconds?: number;
};

type TenantRelation =
  | {
      id?: number;
      slug?: string;
      timeZone?: string | null;
    }
  | number
  | null
  | undefined;

type LessonTimeZoneSource = {
  timeZone?: string | null;
  tenant?: TenantRelation;
};

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(
  value?: string | null,
  fallback = DEFAULT_TIME_ZONE
): string {
  return isValidTimeZone(value) ? value : fallback;
}

export function resolveLessonTimeZone(
  lesson: LessonTimeZoneSource | null | undefined,
  fallback = DEFAULT_TIME_ZONE
): string {
  if (lesson && isValidTimeZone(lesson.timeZone)) {
    return lesson.timeZone;
  }

  if (
    lesson?.tenant &&
    typeof lesson.tenant === "object" &&
    isValidTimeZone(lesson.tenant.timeZone)
  ) {
    return lesson.tenant.timeZone;
  }

  return fallback;
}

export function getZonedDateParts(dateLike: DateLike, timeZone: string) {
  const zoned = new TZDate(new Date(dateLike), timeZone);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    date: zoned.getDate(),
  };
}

export function getDayBoundsInTimeZone(dateLike: DateLike, timeZone: string) {
  const { year, month, date } = getZonedDateParts(dateLike, timeZone);
  return {
    startOfDay: new TZDate(year, month, date, 0, 0, 0, 0, timeZone),
    endOfDay: new TZDate(year, month, date, 23, 59, 59, 999, timeZone),
  };
}

export function combineDateAndTimeInTimeZone(
  dateLike: DateLike,
  wallClockTime: WallClockTime,
  timeZone: string
) {
  const { year, month, date } = getZonedDateParts(dateLike, timeZone);
  return new TZDate(
    year,
    month,
    date,
    wallClockTime.hours,
    wallClockTime.minutes,
    wallClockTime.seconds ?? 0,
    wallClockTime.milliseconds ?? 0,
    timeZone
  );
}

export function extractUtcWallClock(timeLike: TimeLike) {
  const date = new Date(timeLike);
  return {
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
    milliseconds: date.getUTCMilliseconds(),
  };
}

export function formatInTimeZone(
  dateLike: DateLike,
  pattern: string,
  timeZone: string
) {
  return format(new TZDate(new Date(dateLike), timeZone), pattern);
}

export function formatDateInTimeZone(
  dateLike: DateLike,
  locales: string | string[],
  timeZone: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(locales, {
    ...options,
    timeZone,
  }).format(new Date(dateLike));
}

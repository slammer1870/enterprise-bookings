import { TZDate } from "@date-fns/tz";

/**
 * Plugin default timezone. Timeslot hooks recombine start/end wall-clock times onto
 * `date` in this zone — relative `Date.now() + N hours` fixtures break after local
 * midnight (CI often runs late UTC).
 */
export const TEST_TIMESLOT_TIMEZONE = "Europe/Dublin";

type TimeslotWindow = {
  date: Date;
  startTime: Date;
  endTime: Date;
};

const zonedDay = (daysFromToday: number) => {
  const now = new TZDate(new Date(), TEST_TIMESLOT_TIMEZONE);
  return new TZDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysFromToday,
    0,
    0,
    0,
    0,
    TEST_TIMESLOT_TIMEZONE,
  );
};

const windowOnDay = (
  day: TZDate,
  startHour: number,
  durationHours: number,
): TimeslotWindow => {
  const start = new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    startHour,
    0,
    0,
    0,
    TEST_TIMESLOT_TIMEZONE,
  );
  const end = new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    startHour + durationHours,
    0,
    0,
    0,
    TEST_TIMESLOT_TIMEZONE,
  );

  return {
    date: new Date(day.getTime()),
    startTime: new Date(start.getTime()),
    endTime: new Date(end.getTime()),
  };
};

/** Future midday slot that stays on the same calendar day after timezone recombination. */
export function futureTimeslotWindow(options?: {
  daysFromNow?: number;
  startHour?: number;
  durationHours?: number;
}): TimeslotWindow {
  const daysFromNow = options?.daysFromNow ?? 1;
  const startHour = options?.startHour ?? 10;
  const durationHours = options?.durationHours ?? 1;
  return windowOnDay(zonedDay(daysFromNow), startHour, durationHours);
}

/** Past midday slot for closed-status assertions. */
export function pastTimeslotWindow(options?: {
  daysAgo?: number;
  startHour?: number;
  durationHours?: number;
}): TimeslotWindow {
  const daysAgo = options?.daysAgo ?? 1;
  const startHour = options?.startHour ?? 10;
  const durationHours = options?.durationHours ?? 1;
  return windowOnDay(zonedDay(-daysAgo), startHour, durationHours);
}

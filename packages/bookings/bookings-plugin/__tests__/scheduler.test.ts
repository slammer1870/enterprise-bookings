import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";

import { generateLessonsFromSchedule } from "../src/tasks/generate-lessons";

describe("Scheduler tests", () => {
  // Production runs in UTC (or a non-Dublin server timezone). Force UTC here so
  // DST boundary bugs don't get masked by the developer machine timezone.
  const ORIGINAL_TZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("does not shift Monday-only schedules to Sunday across Dublin DST start (startDate=Mar 29)", async () => {
    const timeZone = "Europe/Dublin";

    const createdLessons: Array<{ id: number; startTime: string }> = [];

    const payload = {
      config: {
        admin: {
          timezones: {
            defaultTimezone: timeZone,
          },
        },
      },
      logger: {
        info: () => undefined,
        warn: () => undefined,
      },
      find: async (args: any) => {
        // For this regression test we only need "no duplicates exist" behavior.
        if (args?.collection === "lessons") return { docs: [] };
        return { docs: [] };
      },
      delete: async () => ({ docs: [] }),
      create: async (args: any) => {
        if (args?.collection !== "lessons") {
          throw new Error(`Unexpected create on ${String(args?.collection)}`);
        }
        const next = {
          id: createdLessons.length + 1,
          startTime: String(args.data.startTime),
        };
        createdLessons.push(next);
        return next;
      },
    };

    // DST in Dublin starts on the last Sunday in March. In 2026, that's Mar 29.
    // Start the schedule on Mar 29 (Sunday) and only schedule Mondays.
    const startDate = new TZDate(2026, 2, 29, 0, 0, 0, 0, timeZone);
    const endDate = new TZDate(2026, 3, 5, 23, 59, 59, 999, timeZone);

    // Represent a "10:00-11:00" wall-clock slot.
    const slotStart = new TZDate(2000, 0, 1, 10, 0, 0, 0, timeZone);
    const slotEnd = new TZDate(2000, 0, 1, 11, 0, 0, 0, timeZone);

    await (generateLessonsFromSchedule as any)({
      input: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        clearExisting: false,
        defaultClassOption: 1,
        lockOutTime: 60,
        week: {
          // week.days: 0=Monday ... 6=Sunday
          days: [
            {
              timeSlot: [
                {
                  startTime: slotStart.toISOString(),
                  endTime: slotEnd.toISOString(),
                  classOption: 1,
                  location: "Test Location",
                  active: true,
                },
              ],
            },
            { timeSlot: [] }, // Tue
            { timeSlot: [] }, // Wed
            { timeSlot: [] }, // Thu
            { timeSlot: [] }, // Fri
            { timeSlot: [] }, // Sat
            { timeSlot: [] }, // Sun
          ],
        },
      },
      req: {
        payload,
        context: {},
      } as any,
    });

    expect(createdLessons.length).toBeGreaterThan(0);

    // All created lessons should land on a Monday in Europe/Dublin.
    for (const lesson of createdLessons) {
      const start = new TZDate(new Date(lesson.startTime), timeZone);
      // 0=Sunday, 1=Monday, ...
      expect(start.getDay()).toBe(1);
    }
  });

  it("does not shift Monday-only schedules to Sunday across Dublin DST end (startDate=Oct 25)", async () => {
    const timeZone = "Europe/Dublin";

    const createdLessons: Array<{ id: number; startTime: string }> = [];

    const payload = {
      config: {
        admin: {
          timezones: {
            defaultTimezone: timeZone,
          },
        },
      },
      logger: {
        info: () => undefined,
        warn: () => undefined,
      },
      find: async (args: any) => {
        if (args?.collection === "lessons") return { docs: [] };
        return { docs: [] };
      },
      delete: async () => ({ docs: [] }),
      create: async (args: any) => {
        if (args?.collection !== "lessons") {
          throw new Error(`Unexpected create on ${String(args?.collection)}`);
        }
        const next = {
          id: createdLessons.length + 1,
          startTime: String(args.data.startTime),
        };
        createdLessons.push(next);
        return next;
      },
    };

    // DST in Dublin ends on the last Sunday in October. In 2026, that's Oct 25.
    // Start the schedule on Oct 25 (Sunday) and only schedule Mondays.
    const startDate = new TZDate(2026, 9, 25, 0, 0, 0, 0, timeZone);
    const endDate = new TZDate(2026, 10, 1, 23, 59, 59, 999, timeZone);

    const slotStart = new TZDate(2000, 0, 1, 10, 0, 0, 0, timeZone);
    const slotEnd = new TZDate(2000, 0, 1, 11, 0, 0, 0, timeZone);

    await (generateLessonsFromSchedule as any)({
      input: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        clearExisting: false,
        defaultClassOption: 1,
        lockOutTime: 60,
        week: {
          days: [
            {
              timeSlot: [
                {
                  startTime: slotStart.toISOString(),
                  endTime: slotEnd.toISOString(),
                  classOption: 1,
                  location: "Test Location",
                  active: true,
                },
              ],
            },
            { timeSlot: [] },
            { timeSlot: [] },
            { timeSlot: [] },
            { timeSlot: [] },
            { timeSlot: [] },
            { timeSlot: [] },
          ],
        },
      },
      req: {
        payload,
        context: {},
      } as any,
    });

    expect(createdLessons.length).toBeGreaterThan(0);

    for (const lesson of createdLessons) {
      const start = new TZDate(new Date(lesson.startTime), timeZone);
      expect(start.getDay()).toBe(1);
    }
  });

});

import { TZDate } from "@date-fns/tz";
import qs from "qs";
import { describe, expect, it } from "vitest";

import { generateLessonCollection } from "../src/collections/lessons";
import { DEFAULT_BOOKINGS_PLUGIN_SLUGS } from "../src/resolve-slugs";
import { getLessonsQuery } from "../src/utils/query";

const LESSON_TIMEZONE = "Europe/Dublin";

const normalizeTimeFields = async (data: Record<string, unknown>) => {
  const lessonCollection = generateLessonCollection(
    {
      enabled: true,
    },
    DEFAULT_BOOKINGS_PLUGIN_SLUGS,
  );
  const hook = lessonCollection.hooks?.beforeChange?.[0];
  if (!hook) throw new Error("Expected lesson beforeChange hook");

  const payload = {
    config: {
      admin: {
        timezones: {
          defaultTimezone: LESSON_TIMEZONE,
        },
      },
    },
  } as any;

  await hook({
    data,
    operation: "create",
    req: {
      payload,
      context: {},
    } as any,
  });

  return data;
};

describe("Lesson beforeChange normalization", () => {
  it("re-bases canonical ISO time picker values onto the selected lesson date", async () => {
    const selectedLessonDate = new TZDate(2026, 3, 1, 0, 0, 0, 0, "Europe/Dublin");
    const adminPickerStartValue = new TZDate(2026, 2, 29, 10, 0, 0, 0, "Europe/Dublin");
    const adminPickerEndValue = new TZDate(2026, 2, 29, 11, 0, 0, 0, "Europe/Dublin");
    const data = {
      date: selectedLessonDate.toISOString(),
      startTime: adminPickerStartValue.toISOString(),
      endTime: adminPickerEndValue.toISOString(),
    } as Record<string, unknown>;

    await normalizeTimeFields(data);

    const start = new TZDate(new Date(String(data.startTime)), "Europe/Dublin");
    const end = new TZDate(new Date(String(data.endTime)), "Europe/Dublin");

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(0);
  });

  it("re-bases admin time picker Date values onto the selected lesson date", async () => {
    const selectedLessonDate = new TZDate(2026, 3, 3, 0, 0, 0, 0, "Europe/Dublin");
    const adminPickerStartValue = new TZDate(2026, 2, 29, 10, 0, 0, 0, "Europe/Dublin");
    const adminPickerEndValue = new TZDate(2026, 2, 29, 11, 0, 0, 0, "Europe/Dublin");
    const data = {
      date: selectedLessonDate.toISOString(),
      startTime: new Date(adminPickerStartValue.toISOString()),
      endTime: new Date(adminPickerEndValue.toISOString()),
    } as Record<string, unknown>;

    await normalizeTimeFields(data);

    const start = new TZDate(new Date(String(data.startTime)), "Europe/Dublin");
    const end = new TZDate(new Date(String(data.endTime)), "Europe/Dublin");

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(3);
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(3);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(0);
  });

  it("normalizes time-only strings against provided object date payload", async () => {
    const lessonDate = new TZDate(2026, 4, 10, 0, 0, 0, 0, "Europe/Dublin");
    const data = {
      date: {
        raw: "legacy-form-date",
        value: lessonDate.toISOString(),
      },
      startTime: "10:00",
      endTime: "11:00",
    } as Record<string, unknown>;

    await normalizeTimeFields(data);

    const start = new TZDate(new Date(String(data.startTime)), "Europe/Dublin");
    const end = new TZDate(new Date(String(data.endTime)), "Europe/Dublin");

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4);
    expect(start.getDate()).toBe(10);
    expect(start.getHours()).toBe(10);
    expect(end.getHours()).toBe(11);
  });

  it("normalizes update-style payload with object date values", async () => {
    const lessonDate = new TZDate(2026, 4, 11, 0, 0, 0, 0, "Europe/Dublin");
    const data = {
      date: {
        raw: "legacy-form-date",
        value: lessonDate.toISOString(),
      },
      startTime: "10:30",
      endTime: "11:30",
    } as Record<string, unknown>;

    await normalizeTimeFields(data);

    const start = new TZDate(new Date(String(data.startTime)), "Europe/Dublin");
    const end = new TZDate(new Date(String(data.endTime)), "Europe/Dublin");

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(4);
    expect(start.getDate()).toBe(11);
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(30);
  });

  it("returns normalized lesson inside the next-week day query window", async () => {
    const lessonDate = new TZDate(2026, 5, 8, 0, 0, 0, 0, "Europe/Dublin");
    const data = {
      date: {
        raw: "legacy-form-date",
        value: lessonDate.toISOString(),
      },
      startTime: "10:00",
      endTime: "11:00",
    } as Record<string, unknown>;

    await normalizeTimeFields(data);

    const start = new Date(String(data.startTime));
    const query = qs.parse(getLessonsQuery(new Date(lessonDate), LESSON_TIMEZONE), {
      ignoreQueryPrefix: true,
    });
    const queryConditions = query.where?.and as unknown as Array<{
      startTime: { greater_than_equal?: string; less_than_equal?: string };
    }>;
    const dayStart = new Date(String(queryConditions[0]?.startTime.greater_than_equal));
    const dayEnd = new Date(String(queryConditions[1]?.startTime.less_than_equal));
    const lessonDateInTZ = new TZDate(start, "Europe/Dublin");

    expect(start.getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
    expect(start.getTime()).toBeLessThanOrEqual(dayEnd.getTime());
    expect(lessonDateInTZ.getFullYear()).toBe(2026);
    expect(lessonDateInTZ.getMonth()).toBe(5);
    expect(lessonDateInTZ.getDate()).toBe(8);
    expect(lessonDateInTZ.getHours()).toBe(10);
    expect(lessonDateInTZ.getMinutes()).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { existingTimeslotKey } from "../src/tasks/create-generate-timeslots-handler";

describe("existingTimeslotKey", () => {
  it("matches migrated and generated instants with the same Dublin wall-clock time", () => {
    const timeZone = "Europe/Dublin";
    const eventTypeId = 42;

    const migratedStart = "2026-06-16T05:45:00.000Z";
    const migratedEnd = "2026-06-16T06:45:00.000Z";
    const generatedStart = "2026-06-16T05:45:00.000Z";
    const generatedEnd = "2026-06-16T06:45:00.000Z";

    expect(
      existingTimeslotKey(migratedStart, migratedEnd, null, eventTypeId, timeZone),
    ).toBe(
      existingTimeslotKey(generatedStart, generatedEnd, null, eventTypeId, timeZone),
    );
  });

  it("treats different event types at the same time as distinct keys", () => {
    const timeZone = "Europe/Dublin";
    const start = "2026-06-16T17:00:00.000Z";
    const end = "2026-06-16T18:00:00.000Z";

    const beginners = existingTimeslotKey(start, end, null, 1, timeZone);
    const fundamentals = existingTimeslotKey(start, end, null, 2, timeZone);

    expect(beginners).not.toBe(fundamentals);
  });

  it("normalizes empty and null locations to the same key", () => {
    const timeZone = "Europe/Dublin";
    const start = "2026-06-16T17:00:00.000Z";
    const end = "2026-06-16T18:00:00.000Z";

    expect(existingTimeslotKey(start, end, null, 1, timeZone)).toBe(
      existingTimeslotKey(start, end, "", 1, timeZone),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  earlierTodayTimeslotWindow,
  futureTimeslotWindow,
  pastTimeslotWindow,
} from "./timeslot-fixtures";

describe("timeslot fixtures", () => {
  beforeEach(() => {
    // Late UTC evening — the old Date.now()+2h pattern recombines onto today in
    // Europe/Dublin and lands in the past.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T21:36:25.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps future windows after local midnight", () => {
    const now = Date.now();
    const window = futureTimeslotWindow();

    expect(window.startTime.getTime()).toBeGreaterThan(now);
    expect(window.endTime.getTime()).toBeGreaterThan(window.startTime.getTime());
  });

  it("keeps past windows before now", () => {
    const now = Date.now();
    const window = pastTimeslotWindow();

    expect(window.endTime.getTime()).toBeLessThan(now);
    expect(window.startTime.getTime()).toBeLessThan(window.endTime.getTime());
  });

  it("keeps earlier-today windows readable under UTC startOfToday access", () => {
    const now = Date.now();
    const startOfTodayUtc = new Date(now);
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const window = earlierTodayTimeslotWindow();

    expect(window.startTime.getTime()).toBeGreaterThan(startOfTodayUtc.getTime());
    expect(window.startTime.getTime()).toBeLessThan(now);
    expect(window.endTime.getTime()).toBeGreaterThan(window.startTime.getTime());
  });
});

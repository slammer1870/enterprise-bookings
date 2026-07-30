import { describe, it, expect } from "vitest";
import { validateCourseDurationMode } from "../src/course/utilities/validate-course-duration-mode";

describe("validateCourseDurationMode", () => {
  it("accepts fixed dates", () => {
    expect(
      validateCourseDurationMode({
        startDate: "2026-09-01",
        endDate: "2026-10-26",
      }),
    ).toBe(true);
  });

  it("accepts duration weeks", () => {
    expect(
      validateCourseDurationMode({
        durationLength: 8,
        durationUnit: "weeks",
      }),
    ).toBe(true);
  });

  it("rejects neither mode", () => {
    expect(validateCourseDurationMode({})).toMatch(/fixed dates.*or a duration/i);
  });

  it("rejects both modes", () => {
    expect(
      validateCourseDurationMode({
        startDate: "2026-09-01",
        endDate: "2026-10-26",
        durationLength: 8,
        durationUnit: "weeks",
      }),
    ).toMatch(/not both/i);
  });

  it("rejects end before start", () => {
    expect(
      validateCourseDurationMode({
        startDate: "2026-10-26",
        endDate: "2026-09-01",
      }),
    ).toMatch(/endDate/i);
  });
});

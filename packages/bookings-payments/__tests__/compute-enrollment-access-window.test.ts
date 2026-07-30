/**
 * Course enrollment access window: fixed product dates OR duration from purchase.
 */
import { describe, it, expect } from "vitest";
import {
  computeEnrollmentAccessWindow,
  resolveCourseDurationMode,
} from "../src/course/utilities/compute-enrollment-access-window";

describe("resolveCourseDurationMode", () => {
  it("returns fixed when startDate and endDate are set", () => {
    expect(
      resolveCourseDurationMode({
        startDate: "2026-09-01",
        endDate: "2026-10-26",
      }),
    ).toBe("fixed");
  });

  it("returns duration when durationLength and durationUnit are set", () => {
    expect(
      resolveCourseDurationMode({
        durationLength: 8,
        durationUnit: "weeks",
      }),
    ).toBe("duration");
  });

  it("returns invalid when both modes are set", () => {
    expect(
      resolveCourseDurationMode({
        startDate: "2026-09-01",
        endDate: "2026-10-26",
        durationLength: 8,
        durationUnit: "weeks",
      }),
    ).toBe("invalid");
  });

  it("returns invalid when neither mode is set", () => {
    expect(resolveCourseDurationMode({})).toBe("invalid");
  });

  it("returns invalid when only one date is set", () => {
    expect(resolveCourseDurationMode({ startDate: "2026-09-01" })).toBe("invalid");
    expect(resolveCourseDurationMode({ endDate: "2026-10-26" })).toBe("invalid");
  });

  it("returns invalid when durationLength is missing or < 1", () => {
    expect(resolveCourseDurationMode({ durationUnit: "weeks" })).toBe("invalid");
    expect(
      resolveCourseDurationMode({ durationLength: 0, durationUnit: "weeks" }),
    ).toBe("invalid");
  });
});

describe("computeEnrollmentAccessWindow", () => {
  it("stamps fixed dates onto the enrollment window", () => {
    const purchasedAt = new Date("2026-08-01T15:00:00.000Z");
    expect(
      computeEnrollmentAccessWindow(
        { startDate: "2026-09-01", endDate: "2026-10-26" },
        purchasedAt,
      ),
    ).toEqual({
      accessStartsAt: "2026-09-01T00:00:00.000Z",
      accessEndsAt: "2026-10-26T23:59:59.999Z",
    });
  });

  it("stamps duration in weeks from purchasedAt", () => {
    const purchasedAt = new Date("2026-07-29T12:00:00.000Z");
    const result = computeEnrollmentAccessWindow(
      { durationLength: 8, durationUnit: "weeks" },
      purchasedAt,
    );
    expect(result.accessStartsAt).toBe(purchasedAt.toISOString());
    const expectedEnd = new Date(purchasedAt);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 8 * 7);
    expect(result.accessEndsAt).toBe(expectedEnd.toISOString());
  });

  it("stamps duration in days from purchasedAt", () => {
    const purchasedAt = new Date("2026-07-29T12:00:00.000Z");
    const result = computeEnrollmentAccessWindow(
      { durationLength: 14, durationUnit: "days" },
      purchasedAt,
    );
    expect(result.accessStartsAt).toBe(purchasedAt.toISOString());
    const expectedEnd = new Date(purchasedAt);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 14);
    expect(result.accessEndsAt).toBe(expectedEnd.toISOString());
  });

  it("throws when course duration mode is invalid", () => {
    expect(() =>
      computeEnrollmentAccessWindow({}, new Date("2026-07-29T12:00:00.000Z")),
    ).toThrow(/duration mode/i);
  });

  it("throws when fixed endDate is before startDate", () => {
    expect(() =>
      computeEnrollmentAccessWindow(
        { startDate: "2026-10-26", endDate: "2026-09-01" },
        new Date("2026-07-29T12:00:00.000Z"),
      ),
    ).toThrow(/endDate/i);
  });
});

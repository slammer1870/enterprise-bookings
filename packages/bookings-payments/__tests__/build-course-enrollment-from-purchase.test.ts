/**
 * Purchase helper: stamp access window onto enrollment create payload.
 */
import { describe, it, expect } from "vitest";
import { buildCourseEnrollmentFromPurchase } from "../src/course/utilities/build-course-enrollment-from-purchase";

describe("buildCourseEnrollmentFromPurchase", () => {
  it("builds enrollment data for a fixed-date course", () => {
    const purchasedAt = new Date("2026-08-01T15:00:00.000Z");
    expect(
      buildCourseEnrollmentFromPurchase({
        userId: 7,
        courseId: 3,
        tenantId: 1,
        transactionId: "pi_test_123",
        purchasedAt,
        course: { startDate: "2026-09-01", endDate: "2026-10-26" },
      }),
    ).toEqual({
      user: 7,
      course: 3,
      tenant: 1,
      status: "active",
      purchasedAt: purchasedAt.toISOString(),
      accessStartsAt: "2026-09-01T00:00:00.000Z",
      accessEndsAt: "2026-10-26T23:59:59.999Z",
      transactionId: "pi_test_123",
    });
  });

  it("builds enrollment data for a duration course from purchase", () => {
    const purchasedAt = new Date("2026-07-29T12:00:00.000Z");
    const result = buildCourseEnrollmentFromPurchase({
      userId: 7,
      courseId: 3,
      tenantId: 1,
      purchasedAt,
      course: { durationLength: 8, durationUnit: "weeks" },
    });
    expect(result.accessStartsAt).toBe(purchasedAt.toISOString());
    const expectedEnd = new Date(purchasedAt);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 56);
    expect(result.accessEndsAt).toBe(expectedEnd.toISOString());
    expect(result.status).toBe("active");
    expect(result.transactionId).toBeUndefined();
  });
});

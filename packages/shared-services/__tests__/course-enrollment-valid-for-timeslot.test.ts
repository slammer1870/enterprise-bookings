/**
 * Pure filter: enrollments valid for a timeslot (access window + allowed courses/types).
 */
import { describe, it, expect } from "vitest";
import { filterValidEnrollmentsForTimeslot } from "../src/course-enrollment-valid-for-timeslot";

const baseLesson = {
  tenant: 1,
  startTime: "2026-09-15T10:00:00.000Z",
  eventType: {
    id: 10,
    paymentMethods: {
      allowedCourses: [100, 200],
    },
  },
};

const baseEnrollment = {
  id: 1,
  tenant: 1,
  status: "active" as const,
  accessStartsAt: "2026-09-01T00:00:00.000Z",
  accessEndsAt: "2026-10-26T23:59:59.999Z",
  course: {
    id: 100,
    status: "open" as const,
    allowedEventTypes: [10, 11],
  },
};

describe("filterValidEnrollmentsForTimeslot", () => {
  it("keeps an active enrollment in window for an allowed course/type", () => {
    expect(filterValidEnrollmentsForTimeslot(baseLesson, [baseEnrollment])).toEqual([
      baseEnrollment,
    ]);
  });

  it("rejects cancelled enrollments", () => {
    expect(
      filterValidEnrollmentsForTimeslot(baseLesson, [
        { ...baseEnrollment, status: "cancelled" },
      ]),
    ).toEqual([]);
  });

  it("rejects when timeslot is before accessStartsAt", () => {
    expect(
      filterValidEnrollmentsForTimeslot(
        { ...baseLesson, startTime: "2026-08-31T10:00:00.000Z" },
        [baseEnrollment],
      ),
    ).toEqual([]);
  });

  it("rejects when timeslot is after accessEndsAt", () => {
    expect(
      filterValidEnrollmentsForTimeslot(
        { ...baseLesson, startTime: "2026-10-27T00:00:00.000Z" },
        [baseEnrollment],
      ),
    ).toEqual([]);
  });

  it("rejects when course is not in event type allowedCourses", () => {
    expect(
      filterValidEnrollmentsForTimeslot(baseLesson, [
        {
          ...baseEnrollment,
          course: { ...baseEnrollment.course, id: 999 },
        },
      ]),
    ).toEqual([]);
  });

  it("rejects when event type is not in course allowedEventTypes", () => {
    expect(
      filterValidEnrollmentsForTimeslot(
        {
          ...baseLesson,
          eventType: {
            id: 99,
            paymentMethods: { allowedCourses: [100] },
          },
        },
        [baseEnrollment],
      ),
    ).toEqual([]);
  });

  it("rejects archived courses", () => {
    expect(
      filterValidEnrollmentsForTimeslot(baseLesson, [
        {
          ...baseEnrollment,
          course: { ...baseEnrollment.course, status: "archived" },
        },
      ]),
    ).toEqual([]);
  });

  it("rejects wrong tenant", () => {
    expect(
      filterValidEnrollmentsForTimeslot(baseLesson, [
        { ...baseEnrollment, tenant: 2 },
      ]),
    ).toEqual([]);
  });

  it("returns empty when event type has no allowedCourses", () => {
    expect(
      filterValidEnrollmentsForTimeslot(
        {
          ...baseLesson,
          eventType: { id: 10, paymentMethods: { allowedCourses: [] } },
        },
        [baseEnrollment],
      ),
    ).toEqual([]);
  });
});

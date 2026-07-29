import { describe, it, expect } from "vitest";
import {
  COURSE_ENROLLMENT_PAYMENT_METHOD,
  courseEnrollmentBookingFields,
} from "../src/course-enrollment-booking-fields";

describe("courseEnrollmentBookingFields", () => {
  it("returns payment method and enrollment id for booking create", () => {
    expect(courseEnrollmentBookingFields(42)).toEqual({
      paymentMethodUsed: COURSE_ENROLLMENT_PAYMENT_METHOD,
      courseEnrollmentIdUsed: 42,
    });
  });

  it("uses course_enrollment as the payment method value", () => {
    expect(COURSE_ENROLLMENT_PAYMENT_METHOD).toBe("course_enrollment");
  });
});

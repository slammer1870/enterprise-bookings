export const COURSE_ENROLLMENT_PAYMENT_METHOD = "course_enrollment" as const;

export type CourseEnrollmentBookingFields = {
  paymentMethodUsed: typeof COURSE_ENROLLMENT_PAYMENT_METHOD;
  courseEnrollmentIdUsed: number;
};

/** Fields to set on a booking when paying with a course enrollment. */
export function courseEnrollmentBookingFields(
  enrollmentId: number,
): CourseEnrollmentBookingFields {
  return {
    paymentMethodUsed: COURSE_ENROLLMENT_PAYMENT_METHOD,
    courseEnrollmentIdUsed: enrollmentId,
  };
}

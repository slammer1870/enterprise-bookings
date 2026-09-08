/**
 * Pure filter: enrollments valid for a timeslot (access window + course entitlement).
 */

export type CourseEnrollmentTimeslotLike = {
  tenant?: number | { id: number } | null;
  startTime?: string | null;
  eventType?: {
    id?: number | null;
    paymentMethods?: {
      allowedCourses?: Array<number | { id: number }> | null;
    } | null;
  } | null;
  classOption?: {
    id?: number | null;
    paymentMethods?: {
      allowedCourses?: Array<number | { id: number }> | null;
    } | null;
  } | null;
};

export type CourseEnrollmentLike = {
  id?: number;
  tenant?: number | { id: number } | null;
  status?: string | null;
  accessStartsAt?: string | null;
  accessEndsAt?: string | null;
  course?:
    | number
    | {
        id?: number | null;
        status?: string | null;
        allowedEventTypes?: Array<number | { id: number }> | null;
      }
    | null;
};

function toId(
  val: number | { id?: number | null } | null | undefined,
): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  return typeof val.id === "number" ? val.id : null;
}

function toIdArray(val: unknown): number[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((v) =>
      typeof v === "object" && v != null && "id" in v
        ? (v as { id: number }).id
        : v,
    )
    .filter((v): v is number => typeof v === "number");
}

/**
 * Returns enrollments valid for the timeslot:
 * same tenant, active, open course, event type ∈ course.allowedEventTypes,
 * and timeslot start within access window.
 *
 * The course owns the entitlement. The event type's allowedCourses relation is
 * an offer/payment configuration and must not revoke an existing enrollment.
 */
export function filterValidEnrollmentsForTimeslot(
  lesson: CourseEnrollmentTimeslotLike,
  enrollments: CourseEnrollmentLike[],
): CourseEnrollmentLike[] {
  const tenantId = toId(
    typeof lesson.tenant === "object" && lesson.tenant != null
      ? lesson.tenant
      : (lesson.tenant as number),
  );
  const eventTypeId = toId(
    lesson.eventType?.id != null
      ? lesson.eventType
      : lesson.classOption?.id != null
        ? lesson.classOption
        : null,
  );
  const slotStart = lesson.startTime ? Date.parse(lesson.startTime) : NaN;
  if (!Number.isFinite(slotStart)) return [];

  return enrollments.filter((enrollment) => {
    const enrollmentTenantId = toId(
      typeof enrollment.tenant === "object" && enrollment.tenant != null
        ? enrollment.tenant
        : (enrollment.tenant as number),
    );
    if (tenantId != null && enrollmentTenantId !== tenantId) return false;
    if (enrollment.status !== "active") return false;

    const accessStart = enrollment.accessStartsAt
      ? Date.parse(enrollment.accessStartsAt)
      : NaN;
    const accessEnd = enrollment.accessEndsAt
      ? Date.parse(enrollment.accessEndsAt)
      : NaN;
    if (!Number.isFinite(accessStart) || !Number.isFinite(accessEnd))
      return false;
    if (slotStart < accessStart || slotStart > accessEnd) return false;

    const course = enrollment.course;
    if (course == null || typeof course === "number") return false;
    const courseId = toId(course);
    if (courseId == null) return false;
    if (course.status !== "open") return false;

    const allowedEventTypeIds = toIdArray(course.allowedEventTypes);
    if (eventTypeId == null || !allowedEventTypeIds.includes(eventTypeId))
      return false;

    return true;
  });
}

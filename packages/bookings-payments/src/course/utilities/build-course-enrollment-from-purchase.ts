import {
  computeEnrollmentAccessWindow,
  type CourseAccessWindowInput,
} from "./compute-enrollment-access-window";

export type BuildCourseEnrollmentFromPurchaseArgs = {
  userId: number;
  courseId: number;
  tenantId: number;
  purchasedAt: Date;
  course: CourseAccessWindowInput;
  transactionId?: string;
};

export type CourseEnrollmentCreateData = {
  user: number;
  course: number;
  tenant: number;
  status: "active";
  purchasedAt: string;
  accessStartsAt: string;
  accessEndsAt: string;
  transactionId?: string;
};

/** Build Payload create payload for a course enrollment after successful purchase. */
export function buildCourseEnrollmentFromPurchase(
  args: BuildCourseEnrollmentFromPurchaseArgs,
): CourseEnrollmentCreateData {
  const window = computeEnrollmentAccessWindow(args.course, args.purchasedAt);
  return {
    user: args.userId,
    course: args.courseId,
    tenant: args.tenantId,
    status: "active",
    purchasedAt: args.purchasedAt.toISOString(),
    accessStartsAt: window.accessStartsAt,
    accessEndsAt: window.accessEndsAt,
    ...(args.transactionId ? { transactionId: args.transactionId } : {}),
  };
}

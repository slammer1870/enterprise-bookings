import type { CollectionConfig, Field } from "payload";
import {
  courseEnrollmentsReadAccess,
  courseEnrollmentsCreateAccess,
  courseEnrollmentsUpdateAccess,
  courseEnrollmentsDeleteAccess,
} from "../access/course-enrollments";
import type { CollectionOverrides } from "../../types";

const STATUS_OPTIONS = ["active", "cancelled", "completed"] as const;

export type CourseEnrollmentsOpts = {
  adminGroup?: string;
  overrides?: CollectionOverrides;
};

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: courseEnrollmentsReadAccess,
  create: courseEnrollmentsCreateAccess,
  update: courseEnrollmentsUpdateAccess,
  delete: courseEnrollmentsDeleteAccess,
};

export function courseEnrollmentsCollection(
  opts: CourseEnrollmentsOpts = {},
): CollectionConfig {
  const adminGroup = opts.adminGroup ?? "Billing";
  const overrides = opts.overrides;

  const defaultFields: Field[] = [
    {
      name: "user",
      label: "User",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: { description: "Enrolled user" },
    },
    {
      name: "course",
      label: "Course",
      type: "relationship",
      relationTo: "courses" as import("payload").CollectionSlug,
      required: true,
      admin: { description: "Course purchased" },
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [...STATUS_OPTIONS],
      defaultValue: "active",
      required: true,
    },
    {
      name: "purchasedAt",
      label: "Purchased at",
      type: "date",
      required: true,
      admin: { description: "When the course was purchased" },
    },
    {
      name: "accessStartsAt",
      label: "Access starts at",
      type: "date",
      required: true,
      admin: {
        description: "Start of booking access window (stamped at purchase)",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "accessEndsAt",
      label: "Access ends at",
      type: "date",
      required: true,
      admin: {
        description: "End of booking access window (stamped at purchase)",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "transactionId",
      label: "Transaction ID",
      type: "text",
      required: false,
      admin: {
        description: "External transaction id (e.g. Stripe payment intent id).",
      },
    },
  ];

  const access = overrides?.access
    ? { ...defaultAccess, ...overrides.access }
    : defaultAccess;
  const fields = overrides?.fields
    ? overrides.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const hooks = overrides?.hooks
    ? overrides.hooks({ defaultHooks: {} })
    : undefined;

  return {
    slug: "course-enrollments",
    labels: { singular: "Course Enrollment", plural: "Course Enrollments" },
    admin: {
      useAsTitle: "id",
      defaultColumns: ["user", "course", "status", "accessStartsAt", "accessEndsAt"],
      group: adminGroup,
      description: "Purchased course enrollments with stamped access windows",
    },
    access,
    fields,
    ...(hooks ? { hooks } : {}),
  };
}

import type { CollectionBeforeValidateHook, CollectionConfig, Field } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import {
  coursesReadAccess,
  coursesCreateAccess,
  coursesUpdateAccess,
  coursesDeleteAccess,
} from "../access/courses";
import { validateCourseDurationMode } from "../utilities/validate-course-duration-mode";
import type { CollectionOverrides } from "../../types";

const adminOnlyFieldAccess = {
  read: ({ req: { user } }: { req: { user: unknown } }) =>
    checkRole(["admin"], user as User | null),
  create: ({ req: { user } }: { req: { user: unknown } }) =>
    checkRole(["admin"], user as User | null),
  update: ({ req: { user } }: { req: { user: unknown } }) =>
    checkRole(["admin"], user as User | null),
};

export type CoursesOpts = {
  eventTypesSlug?: string;
  adminGroup?: string;
  overrides?: CollectionOverrides;
};

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: coursesReadAccess,
  create: coursesCreateAccess,
  update: coursesUpdateAccess,
  delete: coursesDeleteAccess,
};

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Open", value: "open" },
  { label: "Closed", value: "closed" },
  { label: "Archived", value: "archived" },
] as const;

export function coursesCollection(opts: CoursesOpts = {}): CollectionConfig {
  const eventTypesSlug = opts.eventTypesSlug ?? "event-types";
  const adminGroup = opts.adminGroup ?? "Products";
  const overrides = opts.overrides;

  const defaultFields: Field[] = [
    {
      name: "title",
      label: "Title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "URL slug for /courses/[slug]. Unique per tenant when multi-tenant.",
      },
    },
    {
      name: "about",
      label: "About",
      type: "textarea",
      required: false,
      admin: {
        description: "Course description shown on the public detail page About section.",
      },
    },
    {
      name: "startDate",
      label: "Start date",
      type: "date",
      required: false,
      admin: {
        description: "Fixed cohort start. Use with end date (not with duration).",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "endDate",
      label: "End date",
      type: "date",
      required: false,
      admin: {
        description: "Fixed cohort end. Use with start date (not with duration).",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "durationLength",
      label: "Duration length",
      type: "number",
      required: false,
      min: 1,
      admin: {
        description: "Purchase-relative length (e.g. 8). Use with duration unit (not with fixed dates).",
      },
    },
    {
      name: "durationUnit",
      label: "Duration unit",
      type: "select",
      required: false,
      options: [
        { label: "Days", value: "days" },
        { label: "Weeks", value: "weeks" },
      ],
      defaultValue: "weeks",
      admin: {
        description: "Unit for purchase-relative duration.",
      },
    },
    {
      name: "allowedEventTypes",
      label: "Allowed event types",
      type: "relationship",
      relationTo: eventTypesSlug as import("payload").CollectionSlug,
      hasMany: true,
      required: true,
      admin: {
        description: "Event types enrollees may book during their access window.",
      },
    },
    {
      name: "maxEnrollments",
      label: "Max enrollments",
      type: "number",
      required: false,
      min: 1,
      admin: {
        description: "Optional capacity. Leave blank for unlimited.",
      },
    },
    {
      name: "stripeProductId",
      type: "text",
      label: "Stripe product",
      required: false,
      access: adminOnlyFieldAccess,
      admin: {
        description: "Link to a Stripe product with a one-time default price.",
        position: "sidebar",
      },
    },
    {
      name: "priceInformation",
      label: "Price Information",
      type: "group",
      access: adminOnlyFieldAccess,
      admin: {
        description: "Price information. Synced from Stripe when a product is linked.",
      },
      fields: [
        {
          name: "price",
          type: "number",
          label: "Price (€)",
          admin: {
            description: "One-time price in euros (from Stripe default price)",
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      options: [...STATUS_OPTIONS],
      defaultValue: "draft",
      required: true,
      admin: {
        description: "Open courses can be purchased; archived cannot be used for booking.",
        position: "sidebar",
      },
    },
  ];

  const defaultHooks: NonNullable<CollectionConfig["hooks"]> = {
    beforeValidate: [
      (async ({ data }) => {
        if (!data || typeof data !== "object") return data;
        const result = validateCourseDurationMode(data);
        if (result !== true) {
          throw new Error(result);
        }
        return data;
      }) satisfies CollectionBeforeValidateHook,
    ],
  };

  const access = overrides?.access
    ? { ...defaultAccess, ...overrides.access }
    : defaultAccess;
  const fields = overrides?.fields
    ? overrides.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const hooks = overrides?.hooks
    ? overrides.hooks({ defaultHooks })
    : defaultHooks;

  return {
    slug: "courses",
    labels: { singular: "Course", plural: "Courses" },
    admin: {
      useAsTitle: "title",
      defaultColumns: ["title", "slug", "status", "startDate", "endDate"],
      group: adminGroup,
      description:
        "Courses grant enrolled users free booking of allowed event types during an access window.",
    },
    access,
    fields,
    hooks,
  };
}

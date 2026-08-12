import type { CollectionBeforeValidateHook, CollectionConfig, Field } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import {
  coursesReadAccess,
  coursesCreateAccess,
  coursesUpdateAccess,
  coursesDeleteAccess,
} from "../access/courses";
import { resolveCourseDurationMode } from "../utilities/compute-enrollment-access-window";
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

type CourseAccessWindowMode = "fixed" | "duration";

function isAccessWindowMode(value: unknown): value is CourseAccessWindowMode {
  return value === "fixed" || value === "duration";
}

/** Clear the unused mode so fixed dates and duration stay mutually exclusive. */
function applyAccessWindowMode(
  data: Record<string, unknown>,
): Record<string, unknown> {
  let mode = isAccessWindowMode(data.accessWindowMode)
    ? data.accessWindowMode
    : undefined;

  if (!mode) {
    const resolved = resolveCourseDurationMode(data);
    if (resolved === "fixed" || resolved === "duration") {
      mode = resolved;
      data.accessWindowMode = mode;
    }
  }

  if (mode === "fixed") {
    data.durationLength = null;
    data.durationUnit = null;
  } else if (mode === "duration") {
    data.startDate = null;
    data.endDate = null;
  }

  return data;
}

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
      type: "richText",
      required: false,
      admin: {
        description: "Course description shown on the public detail page About section.",
      },
    },
    {
      name: "footer",
      label: "Footer",
      type: "richText",
      required: false,
      admin: {
        description:
          "Optional content below the description (e.g. a map). On mobile it appears under the payment form; on large screens it stays under About with the form on the right.",
      },
    },
    {
      name: "coverImage",
      label: "Cover image",
      type: "upload",
      relationTo: "media",
      required: false,
      admin: {
        description: "Hero cover for the course listing and detail pages.",
      },
    },
    {
      name: "accessWindowMode",
      label: "Access window",
      type: "radio",
      required: true,
      options: [
        { label: "Fixed start & end dates", value: "fixed" },
        { label: "Duration from purchase", value: "duration" },
      ],
      admin: {
        description:
          "Choose one: fixed cohort dates, or access length starting from purchase.",
        layout: "horizontal",
      },
    },
    {
      name: "startDate",
      label: "Start date",
      type: "date",
      required: false,
      admin: {
        description: "Fixed cohort start date.",
        date: { pickerAppearance: "dayOnly" },
        condition: (_data, siblingData) =>
          (siblingData as { accessWindowMode?: string })?.accessWindowMode ===
          "fixed",
      },
    },
    {
      name: "endDate",
      label: "End date",
      type: "date",
      required: false,
      admin: {
        description: "Fixed cohort end date.",
        date: { pickerAppearance: "dayOnly" },
        condition: (_data, siblingData) =>
          (siblingData as { accessWindowMode?: string })?.accessWindowMode ===
          "fixed",
      },
    },
    {
      name: "durationLength",
      label: "Duration length",
      type: "number",
      required: false,
      min: 1,
      admin: {
        description: "Access length from purchase (e.g. 8).",
        condition: (_data, siblingData) =>
          (siblingData as { accessWindowMode?: string })?.accessWindowMode ===
          "duration",
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
        condition: (_data, siblingData) =>
          (siblingData as { accessWindowMode?: string })?.accessWindowMode ===
          "duration",
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
      (async ({ data, originalDoc }) => {
        if (!data || typeof data !== "object") return data;

        const merged: Record<string, unknown> = {
          ...(originalDoc && typeof originalDoc === "object"
            ? (originalDoc as Record<string, unknown>)
            : {}),
          ...(data as Record<string, unknown>),
        };

        applyAccessWindowMode(merged);

        const mode = isAccessWindowMode(merged.accessWindowMode)
          ? merged.accessWindowMode
          : undefined;
        if (mode) {
          ;(data as Record<string, unknown>).accessWindowMode = mode;
          if (mode === "fixed") {
            ;(data as Record<string, unknown>).durationLength = null;
            ;(data as Record<string, unknown>).durationUnit = null;
          } else {
            ;(data as Record<string, unknown>).startDate = null;
            ;(data as Record<string, unknown>).endDate = null;
          }
        }

        const result = validateCourseDurationMode(merged);
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
      defaultColumns: [
        "title",
        "slug",
        "status",
        "accessWindowMode",
        "startDate",
        "endDate",
      ],
      group: adminGroup,
      description:
        "Courses grant enrolled users free booking of allowed event types during an access window.",
    },
    access,
    fields,
    hooks,
  };
}

import {
  CollectionConfig,
  Field,
  Labels,
  CollectionAdminOptions,
  CollectionSlug,
} from "payload";

import { getRemainingCapacity } from "../hooks/remaining-capacity";
import { getBookingStatus } from "../hooks/booking-status";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types/";
import {
  combineDateAndTimeInTimeZone,
  extractUtcWallClock,
  resolveTimeZone,
} from "@repo/shared-utils";

import type { BookingsPluginConfig } from "../types";

import { AccessControls, HooksConfig } from "@repo/shared-types";

import { lessonReadAccess } from "../access/lessons";
import { setLockout } from "../hooks/set-lockout";

const parseTimeString = (value: unknown): { hours: number; minutes: number } | null => {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  // Accept:
  // - "10:00"
  // - "10:00 AM" / "10:00PM"
  const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!m) return null;

  let hours = parseInt(m[1]!, 10);
  const minutes = parseInt(m[2]!, 10);
  const ampm = (m[3] ?? "").toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  // 24h format
  if (!ampm) {
    if (hours < 0 || hours > 23) return null;
    return { hours, minutes };
  }

  // 12h format
  if (hours < 1 || hours > 12) return null;
  if (ampm === "AM") hours = hours === 12 ? 0 : hours;
  if (ampm === "PM") hours = hours === 12 ? 12 : hours + 12;
  return { hours, minutes };
};

const coerceToDateForTimeOnlyField = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const t = parseTimeString(value);
    if (t) {
      const d = new Date();
      d.setHours(t.hours, t.minutes, 0, 0);
      return d;
    }
  }
  return null;
};

/** Get a valid date from siblingData.date or from value (e.g. full ISO string). Used so API create works when date is not yet in siblingData or is localized. */
const getBaseDate = (siblingData: Record<string, unknown>, value: unknown): Date | null => {
  const raw = siblingData?.date;
  if (raw != null) {
    const str =
      typeof raw === "string"
        ? raw
        : raw instanceof Date
          ? raw.toISOString()
          : typeof raw === "object" && raw !== null
            ? (Object.values(raw)[0] as string | undefined)
            : undefined;
    const d = str != null ? new Date(str) : raw instanceof Date ? raw : null;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  const time = coerceToDateForTimeOnlyField(value);
  if (time && !Number.isNaN(time.getTime())) return time;
  return null;
};

const getDefaultTimeZone = (req: { payload?: { config?: { admin?: { timezones?: { defaultTimezone?: string } } } } } | undefined) =>
  resolveTimeZone(req?.payload?.config?.admin?.timezones?.defaultTimezone);

const getTenantIdFromValue = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "number"
      ? id
      : typeof id === "string"
        ? Number(id)
        : null;
  }
  return null;
};

const getTenantTimeZoneFromValue = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  return typeof (value as { timeZone?: unknown }).timeZone === "string"
    ? ((value as { timeZone?: string }).timeZone ?? null)
    : null;
};

const getWallClockTime = (value: unknown): {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
} | null => {
  if (typeof value === "string") {
    const parsedTime = parseTimeString(value);
    if (parsedTime) {
      return {
        hours: parsedTime.hours,
        minutes: parsedTime.minutes,
        seconds: 0,
        milliseconds: 0,
      };
    }
  }

  if (value instanceof Date || typeof value === "string") {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return extractUtcWallClock(parsedDate);
    }
  }

  return null;
};

const resolveLessonTimeZoneForValidation = (
  siblingData: Record<string, unknown>,
  fallbackTimeZone: string
) => {
  const siblingTenantTimeZone = getTenantTimeZoneFromValue(siblingData?.tenant);
  if (siblingTenantTimeZone) return resolveTimeZone(siblingTenantTimeZone, fallbackTimeZone);
  return fallbackTimeZone;
};

const resolveLessonTimeZone = async ({
  req,
  siblingData,
}: {
  req: any;
  siblingData: Record<string, unknown>;
}) => {
  const fallbackTimeZone = getDefaultTimeZone(req);
  const siblingTenantTimeZone = getTenantTimeZoneFromValue(siblingData?.tenant);
  if (siblingTenantTimeZone) return resolveTimeZone(siblingTenantTimeZone, fallbackTimeZone);

  const tenantId = getTenantIdFromValue(siblingData?.tenant ?? req?.context?.tenant);
  if (!tenantId || !req?.payload?.findByID) return fallbackTimeZone;

  try {
    const tenant = await req.payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      req,
    });

    return resolveTimeZone(
      typeof tenant?.timeZone === "string" ? tenant.timeZone : null,
      fallbackTimeZone
    );
  } catch {
    return fallbackTimeZone;
  }
};

const defaultFields: Field[] = [
  {
    type: "row",
    fields: [
      {
        name: "date",
        label: "Date",
        type: "date",
        required: true,
        defaultValue: new Date(),
        localized: true,
        admin: {
          date: {
            displayFormat: "dd/MM/yyyy",
          },
        },
      },
      {
        name: "startTime",
        type: "date",
        required: true,
        admin: {
          date: {
            pickerAppearance: "timeOnly",
          },
        },
        hooks: {
          beforeChange: [
            async ({ value, siblingData, req }) => {
              if (typeof value === "undefined") return value;
              if (req?.context?.skipLessonTimeNormalization) return value;
              const base = getBaseDate((siblingData || {}) as Record<string, unknown>, value);
              if (!base) return value;

              const time = getWallClockTime(value);
              if (!time) return value;

              const timeZone = await resolveLessonTimeZone({
                req,
                siblingData: (siblingData || {}) as Record<string, unknown>,
              });

              return combineDateAndTimeInTimeZone(base, time, timeZone).toISOString();
            },
          ],
        },
      },
      {
        name: "endTime",
        type: "date",
        required: true,
        admin: {
          date: {
            pickerAppearance: "timeOnly",
          },
        },
        hooks: {
          beforeChange: [
            async ({ value, siblingData, req }) => {
              if (typeof value === "undefined") return value;
              if (req?.context?.skipLessonTimeNormalization) return value;
              const base = getBaseDate((siblingData || {}) as Record<string, unknown>, value);
              if (!base) return value;

              const time = getWallClockTime(value);
              if (!time) return value;

              const timeZone = await resolveLessonTimeZone({
                req,
                siblingData: (siblingData || {}) as Record<string, unknown>,
              });

              return combineDateAndTimeInTimeZone(base, time, timeZone).toISOString();
            },
          ],
        },
        validate: (value, options) => {
          const siblingData = options.siblingData as {
            startTime: string;
            date: string;
          };
          if (value && siblingData.startTime && siblingData.date) {
            const fallbackTimeZone = getDefaultTimeZone((options as { req?: any }).req);
            const timeZone = resolveLessonTimeZoneForValidation(
              options.siblingData as Record<string, unknown>,
              fallbackTimeZone
            );
            const endTimeParts = getWallClockTime(value);
            const startTimeParts = getWallClockTime(siblingData.startTime);
            if (!endTimeParts || !startTimeParts) return true;

            const endTime = combineDateAndTimeInTimeZone(
              siblingData.date,
              endTimeParts,
              timeZone
            );
            const startTime = combineDateAndTimeInTimeZone(
              siblingData.date,
              startTimeParts,
              timeZone
            );
            if (endTime <= startTime) {
              return "End time must be greater than start time";
            }
          }
          return true;
        },
      },
    ],
  },
  {
    type: "row",
    fields: [
      {
        name: "lockOutTime",
        label: "Lock Out Time (minutes)",
        admin: {
          description:
            "The time in minutes before the lesson will be closed for new bookings.",
        },
        type: "number",
        required: true,
        defaultValue: 0,
      },
      {
        name: "originalLockOutTime",
        type: "number",
        defaultValue: 0,
        admin: {
          hidden: true,
        },
      },
      {
        name: "location",
        label: "Location",
        type: "text",
        required: false,
      },
      {
        name: "instructor",
        label: "Instructor",
        type: "relationship",
        relationTo: "instructors" as CollectionSlug,
        required: false,
        filterOptions: () => {
          // Only show active instructors in the relationship dropdown
          return {
            active: {
              equals: true,
            },
          };
        },
        access: {
          read: () => true,
        },
      },
    ],
  },
  {
    name: "classOption",
    label: "Class Option",
    type: "relationship",
    relationTo: "class-options",
    required: true,
    hasMany: false,
  },
  {
    name: "remainingCapacity",
    type: "number",
    virtual: true,
    admin: {
      description: "The number of places remaining",
      readOnly: true,
    },
    hooks: {
      afterRead: [getRemainingCapacity],
    },
  },
  {
    name: "bookings",
    label: "Bookings",
    type: "join",
    collection: "bookings",
    maxDepth: 3,
    defaultLimit: 0,
    hasMany: true,
    on: "lesson",
  },
  {
    name: "bookingStatus",
    type: "text",
    admin: {
      description: "Status of the lesson",
      readOnly: true,
      hidden: true,
    },
    hooks: {
      afterRead: [getBookingStatus],
    },
    virtual: true,
  },
  {
    name: "active",
    type: "checkbox",
    defaultValue: true,
    admin: {
      position: "sidebar",
      description:
        "Whether the lesson is active and will be shown on the schedule",
    },
  },
];

const defaultLabels: Labels = {
  singular: "Lesson",
  plural: "Lessons",
};

const defaultAccess: AccessControls = {
  read: lessonReadAccess,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  components: {
    views: {
      list: {
        Component:
          "@repo/bookings-plugin/src/components/lessons/lesson-admin#LessonAdmin",
      },
    },
  },
  pagination: {
    defaultLimit: 100,
  },
};

const defaultHooks: HooksConfig = {
  beforeOperation: [
    async ({ args, operation }) => {
      if (operation === "create" && args?.data && typeof args.data === "object") {
        // `args.data` is typed as `unknown` here (Payload generics), so safely narrow before writing.
        const data = args.data as Record<string, unknown>;

        // Only set the snapshot field if not explicitly provided.
        if (typeof data.originalLockOutTime === "undefined") {
          data.originalLockOutTime = data.lockOutTime;
        }
      }
      return args;
    },
  ],
  beforeDelete: [
    async ({ req, id }) => {
      await req.payload.delete({
        collection: "bookings",
        where: {
          lesson: {
            equals: id,
          },
        },
        context: {
          triggerAfterChange: false,
        },
      });
    },
  ],
  beforeChange: [
    async ({ data, req, operation }) => {
      // Backward compatibility: If instructor is set to a user ID instead of an instructor ID,
      // automatically create an instructor record for that user
      if (data && data.instructor && operation === "create") {
        try {
          // Check if the instructor ID exists in instructors collection
          const instructor = await req.payload
            .findByID({
              collection: "instructors" as CollectionSlug,
              id: data.instructor,
              req,
            })
            .catch(() => null);

          // If instructor doesn't exist, check if it's a user ID
          if (!instructor) {
            const user = await req.payload
              .findByID({
                collection: "users",
                id: data.instructor,
                req,
              })
              .catch(() => null);

            if (user) {
              // Check if an instructor record already exists for this user
              const existingInstructor = await req.payload.find({
                collection: "instructors" as CollectionSlug,
                where: {
                  user: {
                    equals: data.instructor,
                  },
                },
                limit: 1,
                req,
              });

              if (
                existingInstructor.docs &&
                existingInstructor.docs.length > 0 &&
                existingInstructor.docs[0]
              ) {
                // Use existing instructor
                const existingDoc = existingInstructor.docs[0];
                data.instructor =
                  typeof existingDoc.id === "number"
                    ? existingDoc.id
                    : parseInt(existingDoc.id as string);
              } else {
                // Create new instructor record for this user
                const newInstructor = await req.payload.create({
                  collection: "instructors" as CollectionSlug,
                  data: {
                    user: data.instructor,
                    profileImage: (user as any).image || undefined,
                    active: true,
                  } as any,
                  req,
                });
                data.instructor =
                  typeof newInstructor.id === "number"
                    ? newInstructor.id
                    : parseInt(newInstructor.id as string);
              }
            }
          }
        } catch (error) {
          console.error(
            "Error handling instructor backward compatibility:",
            error
          );
          // If there's an error, set instructor to null to prevent the lesson creation from failing
          if (data) {
            data.instructor = null;
          }
        }
      }
      return data;
    },
  ],
  afterChange: [setLockout],
};

export const generateLessonCollection = (config: BookingsPluginConfig) => {
  const overrides = config?.lessonOverrides;
  const lessonConfig: CollectionConfig = {
    ...(overrides || {}),
    slug: "lessons",
    labels: {
      ...(overrides?.labels || defaultLabels),
    },
    access: {
      ...(overrides?.access && typeof overrides?.access === "function"
        ? overrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(overrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(overrides?.hooks && typeof overrides?.hooks === "function"
        ? overrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      overrides?.fields && typeof overrides?.fields === "function"
        ? overrides.fields({ defaultFields })
        : defaultFields,
  };

  return lessonConfig;
};

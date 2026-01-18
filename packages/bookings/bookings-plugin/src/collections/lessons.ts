import {
  CollectionConfig,
  Field,
  Labels,
  CollectionAdminOptions,
  CollectionSlug,
} from "payload";

import { getRemainingCapacity } from "../hooks/remaining-capacity";
import { getBookingStatus } from "../hooks/booking-status";
import { checkRole } from "@repo/shared-utils/src/check-role";
import type { User } from "@repo/shared-types/";

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
            ({ value, siblingData }) => {
              const date = new Date(siblingData.date);

              // Extract the date parts from value1
              const year = date.getFullYear();
              const month = date.getMonth();
              const day = date.getDate(); // Extract date from sibling data

              const time = coerceToDateForTimeOnlyField(value);
              if (!time) return value;

              const hours = time.getHours();
              const minutes = time.getMinutes();
              const seconds = time.getSeconds();
              const milliseconds = time.getMilliseconds();

              value = new Date(
                year,
                month,
                day,
                hours,
                minutes,
                seconds,
                milliseconds
              );

              return value;
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
            ({ value, siblingData }) => {
              const date = new Date(siblingData.date);

              // Extract the date parts from value1
              const year = date.getFullYear();
              const month = date.getMonth();
              const day = date.getDate(); // Extract date from sibling data

              const time = coerceToDateForTimeOnlyField(value);
              if (!time) return value;

              const hours = time.getHours();
              const minutes = time.getMinutes();
              const seconds = time.getSeconds();
              const milliseconds = time.getMilliseconds();

              value = new Date(
                year,
                month,
                day,
                hours,
                minutes,
                seconds,
                milliseconds
              );

              return value;
            },
          ],
        },
        validate: (value, options) => {
          const siblingData = options.siblingData as {
            startTime: string;
            date: string;
          };
          if (value && siblingData.startTime && siblingData.date) {
            // Apply the same transformation logic as beforeChange hooks
            const date = new Date(siblingData.date);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();

            // Transform endTime
            const endTimeRaw = new Date(value);
            const endTime = new Date(
              year,
              month,
              day,
              endTimeRaw.getHours(),
              endTimeRaw.getMinutes(),
              endTimeRaw.getSeconds(),
              endTimeRaw.getMilliseconds()
            );

            // Transform startTime
            const startTimeRaw = new Date(siblingData.startTime);
            const startTime = new Date(
              year,
              month,
              day,
              startTimeRaw.getHours(),
              startTimeRaw.getMinutes(),
              startTimeRaw.getSeconds(),
              startTimeRaw.getMilliseconds()
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
  const lessonConfig: CollectionConfig = {
    ...(config?.lessonOverrides || {}),
    slug: "lessons",
    labels: {
      ...(config?.lessonOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.lessonOverrides?.access &&
      typeof config?.lessonOverrides?.access === "function"
        ? config.lessonOverrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(config?.lessonOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.lessonOverrides?.hooks &&
      typeof config?.lessonOverrides?.hooks === "function"
        ? config.lessonOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      config?.lessonOverrides?.fields &&
      typeof config?.lessonOverrides?.fields === "function"
        ? config.lessonOverrides.fields({ defaultFields })
        : defaultFields,
  };

  return lessonConfig;
};

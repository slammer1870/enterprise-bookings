import {
  CollectionConfig,
  Field,
  Labels,
  CollectionAdminOptions,
  CollectionSlug,
} from "payload";

import { createGetRemainingCapacity } from "../hooks/remaining-capacity";
import { createGetBookingStatus } from "../hooks/booking-status";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types/";
import {
  combineDateAndTimeInTimeZone,
  extractUtcWallClock,
  resolveTimeZone,
} from "@repo/shared-utils";
import { TZDate } from "@date-fns/tz";

import type { BookingsPluginConfig } from "../types";

import { AccessControls, HooksConfig } from "@repo/shared-types";

import { timeslotReadAccess } from "../access/timeslots";
import { createSetLockout } from "../hooks/set-lockout";

import type { BookingCollectionSlugs } from "../resolve-slugs";

const hasTenantsCollection = (req: any): boolean => {
  const collections = req?.payload?.config?.collections;
  return Array.isArray(collections) && collections.some((collection: any) => collection?.slug === "tenants");
};

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

const resolveTimeslotDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (!value || typeof value !== "object") return null;

  if ("value" in value) {
    const extracted = resolveTimeslotDate((value as { value: unknown }).value);
    if (extracted && !Number.isNaN(extracted.getTime())) return extracted;
  }

  for (const child of Object.values(value)) {
    const extracted = resolveTimeslotDate(child);
    if (extracted && !Number.isNaN(extracted.getTime())) return extracted;
  }

  return null;
};

const normalizeDateForDateField = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const parsedDate = resolveTimeslotDate(value);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString();
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

const getWallClockTimeInTimeZone = (
  value: unknown,
  timeZone?: string
): {
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
      if (timeZone) {
        const zonedDate = new TZDate(parsedDate, timeZone);
        return {
          hours: zonedDate.getHours(),
          minutes: zonedDate.getMinutes(),
          seconds: zonedDate.getSeconds(),
          milliseconds: zonedDate.getMilliseconds(),
        };
      }

      return extractUtcWallClock(parsedDate);
    }
  }

  return null;
};

const resolveTimeslotTimeZoneForValidation = (
  siblingData: Record<string, unknown>,
  fallbackTimeZone: string
) => {
  const siblingTenantTimeZone = getTenantTimeZoneFromValue(siblingData?.tenant);
  if (siblingTenantTimeZone) return resolveTimeZone(siblingTenantTimeZone, fallbackTimeZone);
  return fallbackTimeZone;
};

const resolveTimeslotTimeZone = async ({
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
  if (!tenantId || !req?.payload?.findByID || !hasTenantsCollection(req)) return fallbackTimeZone;

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

function createTimeslotDefaultFields(slugs: BookingCollectionSlugs): Field[] {
  const getRemainingCapacity = createGetRemainingCapacity(slugs);
  const getBookingStatus = createGetBookingStatus(slugs);
  const staffMembersSlug = slugs.staffMembers as CollectionSlug;
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;
  const bookingsSlug = slugs.bookings as CollectionSlug;

  return [
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
        hooks: {
          beforeValidate: [
            ({ value }) => {
              if (value instanceof Date || typeof value === "string") return value;
              const normalizedDate = normalizeDateForDateField(value);
              return normalizedDate ?? value;
            },
          ],
        },
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
              const base = getBaseDate((siblingData || {}) as Record<string, unknown>, value);
              if (!base) return value;

              const timeZone = await resolveTimeslotTimeZone({
                req,
                siblingData: (siblingData || {}) as Record<string, unknown>,
              });

              const time = getWallClockTimeInTimeZone(value, timeZone);
              if (!time) return value;

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
              const base = getBaseDate((siblingData || {}) as Record<string, unknown>, value);
              if (!base) return value;

              const timeZone = await resolveTimeslotTimeZone({
                req,
                siblingData: (siblingData || {}) as Record<string, unknown>,
              });

              const time = getWallClockTimeInTimeZone(value, timeZone);
              if (!time) return value;

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
            const timeZone = resolveTimeslotTimeZoneForValidation(
              options.siblingData as Record<string, unknown>,
              fallbackTimeZone
            );
            const endTimeParts = getWallClockTimeInTimeZone(value, timeZone);
            const startTimeParts = getWallClockTimeInTimeZone(
              siblingData.startTime,
              timeZone
            );
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
            "The time in minutes before the timeslot will be closed for new bookings.",
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
        name: "staffMember",
        label: "StaffMember",
        type: "relationship",
        relationTo: staffMembersSlug,
        required: false,
        filterOptions: () => {
          // Only show active staffMembers in the relationship dropdown
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
    name: "eventType",
    label: "Class Option",
    type: "relationship",
    relationTo: eventTypesSlug,
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
    collection: bookingsSlug,
    maxDepth: 3,
    defaultLimit: 0,
    hasMany: true,
    on: "timeslot",
  },
  {
    name: "bookingStatus",
    type: "text",
    admin: {
      description: "Status of the timeslot",
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
        "Whether the timeslot is active and will be shown on the schedule",
    },
  },
];
}

const defaultLabels: Labels = {
  singular: "Timeslot",
  plural: "Timeslots",
};

const defaultAccess: AccessControls = {
  read: timeslotReadAccess,
  create: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
  update: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
  delete: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  components: {
    views: {
      list: {
        Component:
          "@repo/bookings-plugin/src/components/lessons/timeslot-admin#TimeslotAdmin",
      },
    },
  },
  pagination: {
    defaultLimit: 100,
  },
};

function createTimeslotDefaultHooks(slugs: BookingCollectionSlugs): HooksConfig {
  const staffMembersSlug = slugs.staffMembers as CollectionSlug;
  const bookingsSlug = slugs.bookings as CollectionSlug;
  const setLockout = createSetLockout(slugs);

  return {
    beforeOperation: [
      async ({ args, operation }) => {
        if (
          operation === "create" &&
          args?.data &&
          typeof args.data === "object"
        ) {
          const data = args.data as Record<string, unknown>;

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
          collection: bookingsSlug,
          where: {
            timeslot: {
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
        if (data && data.staffMember && operation === "create") {
          try {
            const staffMember = await req.payload
              .findByID({
                collection: staffMembersSlug,
                id: data.staffMember,
                req,
              })
              .catch(() => null);

            if (!staffMember) {
              const user = await req.payload
                .findByID({
                  collection: "users",
                  id: data.staffMember,
                  req,
                })
                .catch(() => null);

              if (user) {
                const existingStaffMember = await req.payload.find({
                  collection: staffMembersSlug,
                  where: {
                    user: {
                      equals: data.staffMember,
                    },
                  },
                  limit: 1,
                  req,
                });

                if (
                  existingStaffMember.docs &&
                  existingStaffMember.docs.length > 0 &&
                  existingStaffMember.docs[0]
                ) {
                  const existingDoc = existingStaffMember.docs[0];
                  data.staffMember =
                    typeof existingDoc.id === "number"
                      ? existingDoc.id
                      : parseInt(existingDoc.id as string);
                } else {
                  const newStaffMember = await req.payload.create({
                    collection: staffMembersSlug,
                    data: {
                      user: data.staffMember,
                      profileImage: (user as any).image || undefined,
                      active: true,
                    } as any,
                    req,
                  });
                  data.staffMember =
                    typeof newStaffMember.id === "number"
                      ? newStaffMember.id
                      : parseInt(newStaffMember.id as string);
                }
              }
            }
          } catch (error) {
            console.error(
              "Error handling staffMember backward compatibility:",
              error
            );
            if (data) {
              data.staffMember = null;
            }
          }
        }

        if (req?.context?.skipTimeslotTimeNormalization) {
          return data;
        }

        if (data?.date) {
          const siblingData = data as Record<string, unknown>;
          const timeslotDate = resolveTimeslotDate(data.date);
          if (timeslotDate) {
            const timeZone = await resolveTimeslotTimeZone({
              req,
              siblingData,
            });

            const normalizeTimeField = (fieldName: "startTime" | "endTime") => {
              const rawValue = siblingData?.[fieldName];
              if (typeof rawValue === "undefined") return;

              const time = getWallClockTimeInTimeZone(rawValue, timeZone);
              if (!time) return;

              siblingData[fieldName] = combineDateAndTimeInTimeZone(
                timeslotDate,
                time,
                timeZone
              ).toISOString();
            };

            normalizeTimeField("startTime");
            normalizeTimeField("endTime");
          }
        }
        return data;
      },
    ],
    afterChange: [setLockout],
  };
}

export const generateTimeslotCollection = (
  config: BookingsPluginConfig,
  slugs: BookingCollectionSlugs,
) => {
  const overrides = config?.timeslotOverrides;
  const defaultFields = createTimeslotDefaultFields(slugs);
  const defaultHooks = createTimeslotDefaultHooks(slugs);

  const timeslotConfig: CollectionConfig = {
    ...(overrides || {}),
    slug: slugs.timeslots,
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

  return timeslotConfig;
};

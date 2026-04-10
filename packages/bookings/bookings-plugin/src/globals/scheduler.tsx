import { Field, GlobalConfig, CollectionSlug } from "payload";

import type { BookingCollectionSlugs } from "../resolve-slugs";
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from "../resolve-slugs";

function createSchedulerDaysField(slugs: BookingCollectionSlugs): Field {
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;
  const staffMembersSlug = slugs.staffMembers as CollectionSlug;

  return {
    name: "days",
    label: "Days",
    type: "array",
    minRows: 7,
    maxRows: 7,
    admin: {
      components: {
        RowLabel:
          "@repo/bookings-plugin/src/components/scheduler/day-row-label#DayRowLabel",
      },
    },
    fields: [
      {
        name: "timeSlot",
        type: "array",
        required: false,
        validate: (value) => {
          if (!value || !Array.isArray(value)) return true;

          for (let i = 0; i < value.length; i++) {
            const currentSlot = value[i] as any;

            for (let j = i + 1; j < value.length; j++) {
              const otherSlot = value[j] as any;

              if (currentSlot.location !== otherSlot.location) continue;

              const currentStart = new Date(currentSlot.startTime);
              const currentEnd = new Date(currentSlot.endTime);
              const otherStart = new Date(otherSlot.startTime);
              const otherEnd = new Date(otherSlot.endTime);

              currentStart.setFullYear(2000, 0, 1);
              currentEnd.setFullYear(2000, 0, 1);
              otherStart.setFullYear(2000, 0, 1);
              otherEnd.setFullYear(2000, 0, 1);

              const hasTimeOverlap =
                currentStart < otherEnd && currentStart > otherStart;

              if (hasTimeOverlap) {
                return `Time slot conflict: ${currentStart.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}-${currentEnd.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })} and ${otherStart.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}-${otherEnd.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })} overlap at location "${currentSlot.location}"`;
              }
            }
          }

          return true;
        },
        fields: [
          {
            name: "startTime",
            label: "Start Time",
            type: "date",
            defaultValue: new Date(),
            admin: {
              date: {
                pickerAppearance: "timeOnly",
                timeFormat: "HH:mm",
              },
            },
            required: true,
          },
          {
            name: "endTime",
            label: "End Time",
            type: "date",
            defaultValue: new Date(),
            admin: {
              date: {
                pickerAppearance: "timeOnly",
                timeFormat: "HH:mm",
              },
            },
            required: true,
            validate: (value, { siblingData }: { siblingData: any }) => {
              if (value && siblingData?.startTime) {
                const endTime = new Date(value);
                const startTime = new Date(siblingData.startTime);

                endTime.setFullYear(2000, 0, 1);
                startTime.setFullYear(2000, 0, 1);

                if (endTime <= startTime) {
                  return "End time must be after start time";
                }
              }
              return true;
            },
          },
          {
            name: "eventType",
            label: "Class Option",
            type: "relationship",
            relationTo: eventTypesSlug,
            hasMany: false,
            admin: {
              description: "Overrides the default class option",
            },
          },
          {
            name: "location",
            label: "Location",
            type: "text",
          },
          {
            name: "staffMember",
            label: "Staff Member",
            type: "relationship",
            relationTo: staffMembersSlug,
            hasMany: false,
            filterOptions: () => {
              return {
                active: {
                  equals: true,
                },
              };
            },
          },
          {
            name: "lockOutTime",
            label: "Lock Out Time (minutes)",
            type: "number",
            admin: {
              description: "Overrides the default lock out time",
            },
          },
          {
            name: "active",
            label: "Active",
            type: "checkbox",
            defaultValue: true,
            admin: {
              description:
                "Whether the time slot is active and will be shown on the schedule",
            },
          },
        ],
      },
    ],
  };
}

export function createSchedulerGlobal(
  slugs: BookingCollectionSlugs,
): GlobalConfig {
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;
  const days = createSchedulerDaysField(slugs);

  return {
    slug: "scheduler",
    label: "Timeslot Scheduler",
    admin: {
      group: "Bookings",
      description: "Create recurring timeslots across your weekly schedule",
    },
    hooks: {
      afterChange: [
        async ({ req, doc }) => {
          const job = await req.payload.jobs.queue({
            task: "generateTimeslotsFromSchedule",
            input: {
              startDate: doc.startDate,
              endDate: doc.endDate,
              week: doc.week,
              clearExisting: doc.clearExisting,
              defaultEventType: doc.defaultEventType,
              lockOutTime: doc.lockOutTime,
            },
          });

          if (job.id) {
            await req.payload.jobs.runByID({
              id: job.id,
            });
          }

          return doc;
        },
      ],
    },
    fields: [
      {
        name: "startDate",
        type: "date",
        required: true,
        admin: {
          description: "When this schedule becomes active",
          date: {
            pickerAppearance: "dayOnly",
            displayFormat: "dd/MM/yyyy",
          },
        },
      },
      {
        name: "endDate",
        type: "date",
        required: true,
        admin: {
          description: "When this schedule stops generating timeslots",
          date: {
            pickerAppearance: "dayOnly",
            displayFormat: "dd/MM/yyyy",
          },
        },
        validate: (value, { data }: { data: any }) => {
          if (value && data?.startDate) {
            const endDate = new Date(value);
            const startDate = new Date(data.startDate);
            if (endDate <= startDate) {
              return "End date must be after start date";
            }
          }
          return true;
        },
      },
      {
        name: "lockOutTime",
        label: "Default Lock Out Time (minutes)",
        type: "number",
        defaultValue: 0,
        required: true,
        admin: {
          description:
            "Minutes before start time when booking closes (can be overridden per slot)",
        },
      },
      {
        name: "defaultEventType",
        label: "Default Class Option",
        type: "relationship",
        relationTo: eventTypesSlug,
        required: true,
        admin: {
          description:
            "Default class type to use when creating timeslots (can be overridden per slot)",
        },
      },
      {
        name: "week",
        label: "Week",
        admin: {
          description: "The days of the week and their time slots",
        },
        type: "group",
        fields: [days],
      },
      {
        name: "clearExisting",
        type: "checkbox",
        label: "Clear Existing Timeslots",
        defaultValue: false,
        admin: {
          description:
            "Clear existing timeslots before generating new ones (this will not delete timeslots that have any bookings)",
        },
      },
    ],
  };
}

export const schedulerGlobal = createSchedulerGlobal(
  DEFAULT_BOOKING_COLLECTION_SLUGS,
);

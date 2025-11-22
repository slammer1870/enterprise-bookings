import { TaskHandler, Field, GlobalConfig, Payload, CollectionSlug } from "payload";
import { addDays } from "date-fns";

const days: Field = {
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

        // Check for time and location conflicts within the same day
        for (let i = 0; i < value.length; i++) {
          const currentSlot = value[i] as any;

          for (let j = i + 1; j < value.length; j++) {
            const otherSlot = value[j] as any;

            // Skip if different locations
            if (currentSlot.location !== otherSlot.location) continue;

            // Check for time overlap
            const currentStart = new Date(currentSlot.startTime);
            const currentEnd = new Date(currentSlot.endTime);
            const otherStart = new Date(otherSlot.startTime);
            const otherEnd = new Date(otherSlot.endTime);

            // Normalize to just time comparison by setting same date
            currentStart.setFullYear(2000, 0, 1);
            currentEnd.setFullYear(2000, 0, 1);
            otherStart.setFullYear(2000, 0, 1);
            otherEnd.setFullYear(2000, 0, 1);

            // Two time periods overlap if: start1 < end2 AND start2 < end1
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

              // Normalize to just time comparison by setting same date
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
          name: "classOption",
          label: "Class Option",
          type: "relationship",
          relationTo: "class-options",
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
          name: "instructor",
          label: "Instructor",
          type: "relationship",
          relationTo: "instructors" as CollectionSlug,
          hasMany: false,
          filterOptions: () => {
            // Only show active instructors in the relationship dropdown
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
      ],
    },
  ],
};

export const schedulerGlobal: GlobalConfig = {
  slug: "scheduler",
  label: "Lesson Scheduler",
  admin: {
    group: "Bookings",
    description: "Create recurring lessons across your weekly schedule",
  },
  hooks: {
    afterChange: [
      async ({ req, doc }) => {
        const job = await req.payload.jobs.queue({
          task: "generateLessonsFromSchedule",
          input: {
            startDate: doc.startDate,
            endDate: doc.endDate,
            week: doc.week,
            clearExisting: doc.clearExisting,
            defaultClassOption: doc.defaultClassOption,
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
        description: "When this schedule stops generating lessons",
        date: {
          pickerAppearance: "dayOnly",
          displayFormat: "dd/MM/yyyy",
        },
      },
      validate: (value, { data }: { data: any }) => {
        // Check if end date is after start date
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
      name: "defaultClassOption",
      label: "Default Class Option",
      type: "relationship",
      relationTo: "class-options",
      required: true,
      admin: {
        description:
          "Default class type to use when creating lessons (can be overridden per slot)",
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
      label: "Clear Existing Lessons",
      defaultValue: false,
      admin: {
        description:
          "Clear existing lessons before generating new ones (this will not delete lessons that have any bookings)",
      },
    },
  ],
};

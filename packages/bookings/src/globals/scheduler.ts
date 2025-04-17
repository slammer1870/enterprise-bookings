import { GlobalConfig, Field, Payload } from "payload";
import { formatISO, addDays, format } from "date-fns";

import { TZDate } from "@date-fns/tz";

import { checkRole } from "@repo/shared-utils";

import { User } from "@repo/shared-types";
// Define the lesson slot fields once to reuse across all days
const createLessonSlotFields = (): Field[] => {
  return [
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
      relationTo: "users",
      hasMany: false,
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
      name: "notes",
      label: "Notes",
      type: "textarea",
    },
    {
      name: "skipDates",
      label: "Skip Dates",
      type: "array",
      admin: {
        description: "Dates to skip when generating lessons",
      },
      fields: [
        {
          name: "date",
          label: "Date",
          type: "date",
          admin: {
            date: {
              pickerAppearance: "dayOnly",
              displayFormat: "dd/MM/yyyy",
            },
          },
        },
      ],
    },
  ];
};

// Create a function to generate the fields for each day
const createDayScheduleFields = (dayName: string): Field => {
  return {
    name: dayName.toLowerCase(),
    label: dayName,
    type: "group",
    fields: [
      {
        name: "isActive",
        label: `Schedule Lessons on ${dayName}s`,
        type: "checkbox",
        defaultValue: true,
      },
      {
        name: "slots",
        label: "Lesson Slots",
        type: "array",
        fields: createLessonSlotFields(),
      },
    ],
  };
};

// Days of the week
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Function to generate lessons from the schedule
export const generateLessonsFromSchedule = async (
  payload: Payload,
  doc: any
) => {
  const {
    startDate,
    endDate,
    schedule,
    generateOptions,
    defaultClassOption,
    lockOutTime,
  } = doc;
  if (!startDate || !endDate || !schedule) {
    return;
  }

  const timeZone =
    payload.config.admin.timezones.defaultTimezone || "Europe/Dublin";

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Track created lessons for reporting
  const created: any[] = [];
  const skipped: any[] = [];
  const conflicts: any[] = [];

  const clearExisting = generateOptions?.clearExisting;

  if (clearExisting) {
    await payload.delete({
      collection: "lessons",
      where: {
        and: [
          {
            date: {
              greater_than_equal: start.toUTCString(),
            },
          },
          {
            date: {
              less_than_equal: end.toUTCString(),
            },
          },
        ],
      },
    });
  }
  // Map day names to day numbers (0 = Sunday, 1 = Monday, etc.)
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  // Process each day between the start and end dates
  let currentDate = new Date(start);
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();

    // Find the corresponding day in the schedule
    const scheduleDayName = Object.keys(dayMap).find(
      (day) => dayMap[day] === dayOfWeek
    );
    if (!scheduleDayName || !schedule[scheduleDayName]) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const scheduleDay = schedule[scheduleDayName];

    // Skip if this day is not active in the schedule
    if (!scheduleDay.isActive) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // Process each slot for this day
    if (scheduleDay.slots && Array.isArray(scheduleDay.slots)) {
      for (const slot of scheduleDay.slots) {
        // Skip dates that are explicitly marked to be skipped
        const isSkippedDate = slot.skipDates?.some((skipDate: any) => {
          const skipDateObj = new Date(skipDate.date);
          return skipDateObj.toDateString() === currentDate.toDateString();
        });

        if (isSkippedDate) {
          skipped.push({
            date: format(currentDate, "yyyy-MM-dd"),
            time: new Date(slot.startTime).toLocaleTimeString(),
            reason: "Explicitly skipped date",
          });
          continue;
        }

        // Create the start and end times for this lesson
        if (!slot.startTime || !slot.endTime) continue;

        const startTimeObj = new TZDate(slot.startTime, timeZone);
        const endTimeObj = new TZDate(slot.endTime, timeZone);

        const lessonStartTime = new TZDate(currentDate, timeZone);
        lessonStartTime.setHours(startTimeObj.getHours());
        lessonStartTime.setMinutes(startTimeObj.getMinutes());
        lessonStartTime.setSeconds(0);
        lessonStartTime.setMilliseconds(0);

        const lessonEndTime = new TZDate(currentDate, timeZone);
        lessonEndTime.setHours(endTimeObj.getHours());
        lessonEndTime.setMinutes(endTimeObj.getMinutes());
        lessonEndTime.setSeconds(0);
        lessonEndTime.setMilliseconds(0);

        // Add these lines to ensure consistent timezone handling
        const finalStartTime = new TZDate(
          formatISO(lessonStartTime, { representation: "complete" }),
          timeZone
        );
        const finalEndTime = new TZDate(
          formatISO(lessonEndTime, { representation: "complete" }),
          timeZone
        );

        // Check for conflicts with existing lessons
        const existingLessons = await payload.find({
          collection: "lessons",
          where: {
            date: {
              equals: formatISO(currentDate, { representation: "date" }),
            },
          },
        });

        let hasConflict = false;
        for (const existing of existingLessons.docs) {
          const existingStart = new TZDate(existing.startTime, timeZone);
          const existingEnd = new TZDate(existing.endTime, timeZone);

          // Check if this lesson overlaps with an existing one
          if (
            (finalStartTime <= existingEnd && finalEndTime >= existingStart) ||
            (existingStart <= finalEndTime && existingEnd >= finalStartTime)
          ) {
            conflicts.push({
              date: format(currentDate, "yyyy-MM-dd"),
              proposedTime: `${format(finalStartTime, "HH:mm")} - ${format(finalEndTime, "HH:mm")}`,
              conflictTime: `${format(existingStart, "HH:mm")} - ${format(existingEnd, "HH:mm")}`,
              lessonId: existing.id,
            });
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) continue;

        // Create the lesson
        try {
          const newLesson = await payload.create({
            collection: "lessons",
            data: {
              date: currentDate.toISOString(),
              startTime: finalStartTime.toISOString(),
              endTime: finalEndTime.toISOString(),
              classOption: slot.classOption || defaultClassOption,
              location: slot.location,
              instructor: slot.instructor?.id,
              lockOutTime: slot.lockOutTime ?? lockOutTime ?? 0,
            },
          });

          created.push({
            id: newLesson.id,
            date: currentDate.toUTCString(),
            time: `${format(finalStartTime, "HH:mm")} - ${format(finalEndTime, "HH:mm")}`,
          });
        } catch (error) {
          console.error("Error creating lesson:", error);
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return { created, skipped, conflicts };
};

export const schedulerGlobal: GlobalConfig = {
  slug: "scheduler",
  label: "Lesson Scheduler",
  admin: {
    group: "Bookings",
    description: "Create recurring lessons across your weekly schedule",
  },
  access: {
    read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  },
  fields: [
    {
      name: "startDate",
      type: "date",
      defaultValue: new Date(),
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
      defaultValue: new Date(),
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
      name: "schedule",
      label: "Weekly Schedule",
      type: "group",
      admin: {
        description: "Set up your recurring lessons for each day of the week",
      },
      fields: weekdays.map((day) => createDayScheduleFields(day)),
    },
    {
      name: "generateOptions",
      label: "Generation Options",
      type: "group",
      admin: {
        description: "Configure how lessons are generated from this schedule",
      },
      fields: [
        {
          name: "clearExisting",
          label: "Clear Existing Lessons",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "Clear existing lessons within the specified date range before generating new ones",
          },
        },
      ],
    },
    {
      name: "generationResults",
      type: "group",
      admin: {
        description: "Results from the last lesson generation",
        readOnly: true,
      },
      fields: [
        {
          name: "lastGenerated",
          type: "date",
          admin: {
            readOnly: true,
          },
        },
        {
          name: "created",
          type: "number",
          admin: {
            readOnly: true,
          },
        },
        {
          name: "skipped",
          type: "number",
          admin: {
            readOnly: true,
          },
        },
        {
          name: "conflicts",
          type: "number",
          admin: {
            readOnly: true,
          },
        },
        {
          name: "details",
          type: "json",
          admin: {
            readOnly: true,
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      ({ req, doc }) => {
        // Only generate lessons on create, not on update to avoid circular references
        generateLessonsFromSchedule(req.payload, doc);

        return doc;
      },
    ],
  },
};

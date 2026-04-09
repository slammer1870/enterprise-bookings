import type { Config, CollectionSlug, Plugin } from "payload";

import { generateLessonCollection } from "../collections/lessons";
import { generateClassOptionsCollection } from "../collections/class-options";
import { generateBookingCollection } from "../collections/bookings";
import { generateInstructorCollection } from "../collections/instructors";

import { BookingsPluginConfig } from "../types";

import { createSchedulerGlobal } from "../globals/scheduler";

import { createGenerateLessonsFromScheduleHandler } from "../tasks/create-generate-lessons-handler";

import { resolveBookingsPluginSlugs } from "../resolve-slugs";

function createGenerateLessonsTaskInputSchema(slugs: {
  classOptions: string;
  instructors: string;
}) {
  const classOptionsSlug = slugs.classOptions as CollectionSlug;
  const instructorsSlug = slugs.instructors as CollectionSlug;

  return [
    {
      name: "startDate",
      type: "date" as const,
      required: true,
    },
    {
      name: "endDate",
      type: "date" as const,
      required: true,
    },
    {
      name: "week",
      type: "group" as const,
      required: true,
      fields: [
        {
          name: "days",
          type: "array" as const,
          required: true,
          minRows: 7,
          maxRows: 7,
          fields: [
            {
              name: "timeSlot",
              type: "array" as const,
              required: true,
              fields: [
                {
                  name: "startTime",
                  type: "date" as const,
                  required: true,
                },
                {
                  name: "endTime",
                  type: "date" as const,
                  required: true,
                },
                {
                  name: "classOption",
                  type: "relationship" as const,
                  relationTo: classOptionsSlug,
                },
                {
                  name: "location",
                  type: "text" as const,
                },
                {
                  name: "instructor",
                  type: "relationship" as const,
                  relationTo: instructorsSlug,
                },
                {
                  name: "lockOutTime",
                  type: "number" as const,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "clearExisting",
      type: "checkbox" as const,
      required: true,
    },
    {
      name: "defaultClassOption",
      type: "relationship" as const,
      relationTo: classOptionsSlug,
      required: true,
    },
    {
      name: "lockOutTime",
      type: "number" as const,
      required: true,
    },
  ];
}

export const bookingsPlugin =
  (pluginOptions: BookingsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    const config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    const slugs = resolveBookingsPluginSlugs(pluginOptions);

    let collections = config.collections || [];

    const instructors = generateInstructorCollection(pluginOptions, slugs);
    const lessons = generateLessonCollection(pluginOptions, slugs);
    const classOptions = generateClassOptionsCollection(pluginOptions, slugs);
    const bookings = generateBookingCollection(pluginOptions, slugs);

    collections.push(instructors);
    collections.push(lessons);
    collections.push(classOptions);
    collections.push(bookings);

    const globals = config.globals || [];

    globals.push(createSchedulerGlobal(slugs));

    config.globals = globals;

    config.collections = collections;

    if (!config.jobs) {
      config.jobs = {
        tasks: [],
      };
    }

    if (!config.jobs.tasks) {
      config.jobs.tasks = [];
    }

    config.jobs.tasks.push({
      slug: "generateLessonsFromSchedule",
      handler: createGenerateLessonsFromScheduleHandler(slugs),
      inputSchema: createGenerateLessonsTaskInputSchema(slugs),
      outputSchema: [
        {
          name: "success",
          type: "checkbox",
        },
        {
          name: "message",
          type: "text",
        },
      ],
      onSuccess: async () => {
        console.log("Task completed");
      },
      onFail: async () => {
        console.log("Task failed");
      },
    });

    const timezones = config.admin?.timezones || {
      defaultTimezone: "Europe/Dublin",
    };

    config.admin!.timezones = timezones;

    return config;
  };

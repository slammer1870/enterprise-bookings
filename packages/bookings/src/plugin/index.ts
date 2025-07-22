import type { Config, Plugin } from "payload";

import { generateLessonCollection } from "../collections/lessons";
import { generateClassOptionsCollection } from "../collections/class-options";
import { generateBookingCollection } from "../collections/bookings";

import { BookingsPluginConfig } from "../types";

import { schedulerGlobal } from "../globals/scheduler";

import { generateLessonsFromSchedule } from "../tasks/generate-lessons";

export const bookingsPlugin =
  (pluginOptions: BookingsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    let collections = config.collections || [];

    const lessons = generateLessonCollection(pluginOptions);
    const classOptions = generateClassOptionsCollection(pluginOptions);
    const bookings = generateBookingCollection(pluginOptions);

    collections.push(lessons);
    collections.push(classOptions);
    collections.push(bookings);

    const globals = config.globals || [];

    globals.push(schedulerGlobal);

    config.globals = globals;

    config.collections = collections;

    // Register task handlers
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
      handler: generateLessonsFromSchedule,
      inputSchema: [
        {
          name: "startDate",
          type: "date",
          required: true,
        },
        {
          name: "endDate",
          type: "date",
          required: true,
        },
        {
          name: "week",
          type: "group",
          required: true,
          fields: [
            {
              name: "days",
              type: "array",
              required: true,
              minRows: 7,
              maxRows: 7,
              fields: [
                {
                  name: "timeSlot",
                  type: "array",
                  required: true,
                  fields: [
                    {
                      name: "startTime",
                      type: "date",
                      required: true,
                    },
                    {
                      name: "endTime",
                      type: "date",
                      required: true,
                    },
                    {
                      name: "classOption",
                      type: "relationship",
                      relationTo: "class-options",
                    },
                    {
                      name: "location",
                      type: "text",
                    },
                    {
                      name: "instructor",
                      type: "relationship",
                      relationTo: "users",
                    },
                    {
                      name: "lockOutTime",
                      type: "number",
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
          type: "checkbox",
          required: true,
        },
        {
          name: "defaultClassOption",
          type: "relationship",
          relationTo: "class-options",
          required: true,
        },
        {
          name: "lockOutTime",
          type: "number",
          required: true,
        },
      ],
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

    let timezones = config.admin?.timezones || {
      defaultTimezone: "Europe/Dublin",
    };

    config.admin!.timezones = timezones;

    return config;
  };

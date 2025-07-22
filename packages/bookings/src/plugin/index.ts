import type { Config, Plugin } from "payload";

import { generateLessonCollection } from "../collections/lessons";
import { generateClassOptionsCollection } from "../collections/class-options";
import { generateBookingCollection } from "../collections/bookings";

import { BookingsPluginConfig } from "../types";

import { schedulerGlobal } from "../globals/scheduler";
import { generateLessonsFromSchedule } from "../task/generate-lessons";

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
    });

    let timezones = config.admin?.timezones || {
      defaultTimezone: "Europe/Dublin",
    };

    config.admin!.timezones = timezones;

    return config;
  };

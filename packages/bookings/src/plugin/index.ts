import type { Config, Plugin } from "payload";

import { generateLessonCollection } from "../collections/lessons";
import { generateClassOptionsCollection } from "../collections/class-options";
import { generateBookingCollection } from "../collections/bookings";

import { BookingsPluginConfig } from "../types";

import { schedulerGlobal } from "../globals/scheduler";

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

    return config;
  };

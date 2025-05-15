import type { CollectionSlug, Config, Field, Plugin } from "payload";

import { generateLessonCollection } from "../collections/lessons";
import { classOptionsCollection } from "../collections/class-options";
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
    const classOptions = classOptionsCollection(pluginOptions);
    const bookings = generateBookingCollection(pluginOptions);

    collections.push(lessons);
    collections.push(classOptions);
    collections.push(bookings);

    const allowedClassesField: Field = {
      name: "allowedClasses",
      label: "Allowed Classes",
      type: "relationship",
      relationTo: "class-options" as CollectionSlug,
      hasMany: true,
    };

    const globals = config.globals || [];

    globals.push(schedulerGlobal);

    config.globals = globals;

    config.collections = collections;

    return config;
  };

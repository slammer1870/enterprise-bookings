import type { CollectionSlug, Config, Field, Plugin } from "payload";

import { generateLessonCollection } from "../collections/lessons";
import { bookingsCollection } from "../collections/bookings";
import { classOptionsCollection } from "../collections/class-options";

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
    const bookings = bookingsCollection(pluginOptions);

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

    if (pluginOptions.paymentMethods?.dropIns) {
      const dropIns = config.collections?.find(
        (collection) => collection.slug === "drop-ins"
      );

      if (!dropIns) {
        throw new Error(
          "Drop-ins collection not found, please enable the payments plugin"
        );
      }

      dropIns.fields.push(allowedClassesField);

      collections = [
        ...collections.filter((c) => c.slug !== "drop-ins"),
        dropIns,
      ];
    }

    const globals = config.globals || [];

    globals.push(schedulerGlobal);

    config.globals = globals;

    config.collections = collections;

    return config;
  };

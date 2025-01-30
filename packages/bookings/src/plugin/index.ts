import type { Config, Plugin } from "payload";

import { lessonsCollection } from "../collections/lessons";
import { bookingsCollection } from "../collections/bookings";
import { classOptionsCollection } from "../collections/class-options";

import { dropInsCollection } from "../collections/payment-methods/drop-ins";

import { BookingsPluginConfig } from "../types";

export const bookingsPlugin =
  (pluginOptions: BookingsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    let collections = config.collections || [];

    const lessons = lessonsCollection;
    const classOptions = classOptionsCollection(pluginOptions);
    const bookings = bookingsCollection;

    collections.push(lessons);
    collections.push(classOptions);
    collections.push(bookings);

    if (pluginOptions.paymentsMethods?.dropIns) {
      const dropIns = dropInsCollection(pluginOptions);
      collections.push(dropIns);
    }

    config.collections = collections;

    return config;
  };

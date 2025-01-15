import type { CollectionConfig, Plugin } from "payload";

import { PluginTypes } from "../types";

import { lessonsCollection } from "../collections/lessons";
import { bookingsCollection } from "../collections/bookings";
import { classOptionsCollection } from "../collections/class-options";
import { dropInsCollection } from "../collections/payments/drop-ins";

export const bookingsPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    const collections = config.collections || [];

    collections.push(lessonsCollection);
    collections.push(classOptionsCollection(pluginOptions));
    collections.push(bookingsCollection);

    if (
      pluginOptions.paymentMethods.stripeSecretKey &&
      pluginOptions.paymentMethods.allowedDropIns
    ) {
      collections.push(dropInsCollection);
    }

    config.collections = collections;

    return config;
  };

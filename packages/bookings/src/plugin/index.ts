import type { CollectionConfig, Config, Plugin } from "payload";

import { PluginTypes } from "../types";

import { lessonsCollection } from "../collections/lessons";
import { bookingsCollection } from "../collections/bookings";
import { classOptionsCollection } from "../collections/class-options";

export const bookingsPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    if (pluginOptions.paymentsEnabled) {
      if (!config.custom?.plugins?.some((p: any) => p.name === "payments")) {
        throw new Error(
          "Payments plugin with custom config is required to enable payments in bookings plugin"
        );
      }
    }

    let collections = config.collections || [];

    collections.push(lessonsCollection);
    collections.push(classOptionsCollection(pluginOptions, config));
    collections.push(bookingsCollection);

    config.collections = collections;

    return config;
  };

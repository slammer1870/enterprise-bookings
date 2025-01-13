import type { CollectionConfig, Plugin } from "payload";

import { PluginTypes } from "../types";

import { lessonsCollection } from "../collections/lessons";
import { bookingsCollection } from "../collections/bookings";
import { classOptionsCollection } from "../collections/class-options";

export const bookingsPlugin =
  ({
    enabled = false,
    childrenEnabled = false,
    paymentsEnabled = false,
  }: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (!enabled) {
      return config;
    }

    const collections: CollectionConfig[] = config.collections || [];
    collections.push(lessonsCollection);
    collections.push(classOptionsCollection(childrenEnabled, paymentsEnabled));
    collections.push(bookingsCollection);

    config.collections = collections;

    return config;
  };

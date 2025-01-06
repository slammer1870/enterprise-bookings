import type { CollectionConfig, Plugin } from "payload";

import { PluginTypes } from "../types";

import { lessonsCollection } from "../collections/lessons";

export const bookingsPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (pluginOptions.enabled === false) {
      return config;
    }

    const collections: CollectionConfig[] = config.collections || [];
    collections.push(lessonsCollection);

    config.collections = collections;

    return config;
  };

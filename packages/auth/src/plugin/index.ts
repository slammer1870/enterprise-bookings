import type { CollectionSlug, Plugin } from "payload";

import { modifyAuthCollection } from "../collections/users";

import type { PluginTypes } from "../types";

export const authPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (pluginOptions.enabled === false) {
      return config;
    }

    // /////////////////////////////////////
    // Modify auth collection
    // /////////////////////////////////////
    const authCollectionSlug = (pluginOptions.authCollection ||
      "users") as CollectionSlug;

    const authCollectionConfig = config.collections?.find(
      (collection) => collection.slug === authCollectionSlug
    );

    if (!authCollectionConfig) {
      throw new Error(
        `The collection with the slug "${authCollectionSlug}" was not found.`
      );
    }
    const modifiedAuthCollection = modifyAuthCollection(
      pluginOptions,
      authCollectionConfig
    );

    config.collections = [
      ...(config.collections?.filter(
        (collection) => collection.slug !== authCollectionSlug
      ) || []),
      modifiedAuthCollection,
    ];

    return config;
  };


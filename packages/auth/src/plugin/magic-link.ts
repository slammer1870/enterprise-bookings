import type { Plugin } from "payload";
import { modifyAuthCollection } from "./auth-collection";
import type { PluginTypes } from "../types";

export const magicLinkPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (pluginOptions.enabled === false) {
      return config;
    }

    // /////////////////////////////////////
    // Modify auth collection
    // /////////////////////////////////////
    const { authCollection = "users", serverURL } = pluginOptions;
    const authCollectionConfig = config.collections?.find(
      (collection) => collection.slug === authCollection
    );
    if (!authCollectionConfig) {
      throw new Error(
        `The collection with the slug "${authCollection}" was not found.`
      );
    }
    const modifiedAuthCollection = modifyAuthCollection(
      pluginOptions,
      authCollectionConfig
    );

    config.collections = [
      ...(config.collections?.filter(
        (collection) => collection.slug !== authCollection
      ) || []),
      modifiedAuthCollection,
    ];

    return config;
  };

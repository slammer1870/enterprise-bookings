import type { Plugin } from "payload";
import { modifyAuthCollection } from "./modify-auth-collection";
import type { PluginTypes } from "./types";

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
    const authCollectionSlug = pluginOptions.authCollection || "users";
    const authCollection = config.collections?.find(
      (collection) => collection.slug === authCollectionSlug
    );
    if (!authCollection) {
      throw new Error(
        `The collection with the slug "${authCollectionSlug}" was not found.`
      );
    }
    const modifiedAuthCollection = modifyAuthCollection(
      pluginOptions,
      authCollection
    );

    config.collections = [
      ...(config.collections?.filter(
        (collection) => collection.slug !== authCollectionSlug
      ) || []),
      modifiedAuthCollection,
    ];

    return config;
  };

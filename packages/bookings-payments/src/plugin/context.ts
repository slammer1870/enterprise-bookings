import type { Config, CollectionConfig } from "payload";

/**
 * Mutable context passed to each feature applicator. Features push to collections/endpoints
 * and may mutate config (e.g. jobs for membership sync task).
 */
export type PluginContext = {
  collections: CollectionConfig[];
  endpoints: NonNullable<Config["endpoints"]>;
  config: Config;
};

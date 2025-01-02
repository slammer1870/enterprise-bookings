import type { Plugin } from "payload";

import { PluginTypes } from "../types";

export const bookingsPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (pluginOptions.enabled === false) {
      return config;
    }

    return config;
  };

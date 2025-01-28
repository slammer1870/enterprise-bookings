import { Config, Plugin } from "payload";

import { RolesPluginConfig } from "../types";

export const rolesPlugin =
  (pluginOptions: RolesPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    return config;
  };

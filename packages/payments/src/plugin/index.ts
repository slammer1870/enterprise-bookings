import type { Config, Plugin } from "payload";

import { modifyUsersCollection } from "../collections/users";
import { dropInsCollection } from "../collections/drop-ins";

import { customersProxy } from "../endpoints/customers";

import { PaymentsPluginConfig } from "../types";

export const paymentsPlugin =
  (pluginOptions: PaymentsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    const pluginConfig = config.custom?.plugins?.find(
      (p: any) => p.name === "payments"
    );

    if (!pluginConfig) {
      throw new Error("Payments plugin config not in custom plugins");
    }

    let collections = config.collections || [];

    const endpoints = config.endpoints || [];

    const usersCollection = collections.find(
      (collection) => collection.slug === "users"
    );

    if (!usersCollection) {
      throw new Error("Users collection not found");
    }

    collections = [
      ...(collections.filter((collection) => collection.slug !== "users") ||
        []),
      modifyUsersCollection(usersCollection),
    ];

    endpoints.push({
      path: "/stripe/customers",
      method: "get",
      handler: customersProxy,
    });

    const dropInsEnabled = pluginOptions.dropInsEnabled;

    if (dropInsEnabled) {
      collections.push(dropInsCollection(config));
    }

    config.collections = collections;
    config.endpoints = endpoints;
    return config;
  };

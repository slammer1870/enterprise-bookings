import type { CollectionSlug, Config, GroupField, Plugin } from "payload";

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

    //TODO: Refactor this to allow for multipe payment methods more efficiently
    if (dropInsEnabled) {
      const dropIns = dropInsCollection(config);

      const classOptions = collections.find(
        (collection) => collection.slug === "class-options"
      );

      if (classOptions) {
        const paymentMethods = classOptions.fields.find(
          (field) => field.type == "group" && field.name == "paymentMethods"
        ) as GroupField;

        if (paymentMethods) {
          paymentMethods.fields.push({
            name: "allowedDropIns",
            label: "Allowed Drop Ins",
            type: "relationship",
            relationTo: dropIns.slug as CollectionSlug,
            hasMany: true,
            required: false,
          });

          dropIns.fields.push({
            name: "allowedClasses",
            label: "Allowed Classes",
            type: "join",
            collection: "class-options",
            on: "paymentMethods.allowedDropIns",
          });
        }
      }
      collections.push(dropIns);
    }

    config.collections = collections;
    config.endpoints = endpoints;

    return config;
  };

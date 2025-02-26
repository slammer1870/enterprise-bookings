import type { Config, Plugin } from "payload";

import { modifyUsersCollection } from "../collections/users";
import { dropInsCollection } from "../collections/drop-ins";

import { customersProxy } from "../endpoints/customers";

import { PaymentsPluginConfig } from "../types";
import { createPaymentIntent } from "../endpoints/create-payment-intent";

export const paymentsPlugin =
  (pluginOptions: PaymentsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    let collections = config.collections || [];

    const endpoints = config.endpoints || [];

    if (pluginOptions.acceptedPaymentMethods?.card) {
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

      endpoints.push({
        path: "/stripe/create-payment-intent",
        method: "post",
        handler: createPaymentIntent,
      });
    }

    collections.push(dropInsCollection);

    config.collections = collections;
    config.endpoints = endpoints;

    return config;
  };

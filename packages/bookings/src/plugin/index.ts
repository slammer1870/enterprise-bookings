import type { Plugin } from "payload";

import { PluginTypes } from "../types";

import { lessonsCollection } from "../collections/lessons";
import { bookingsCollection } from "../collections/bookings";
import { classOptionsCollection } from "../collections/class-options";
import { dropInsCollection } from "../collections/payments/drop-ins";
import { modifyUsersCollection } from "../collections/users";

export const bookingsPlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    let collections = config.collections || [];

    collections.push(lessonsCollection);
    collections.push(classOptionsCollection(pluginOptions));
    collections.push(bookingsCollection);

    if (pluginOptions.paymentMethods.stripeSecretKey) {
      //TODO: Add Stripe Customer ID (and roles) to User collection

      const modifiedUsersCollection = modifyUsersCollection(
        config.collections?.find((c) => c.slug === "users")!
      );

      collections = [
        ...(collections?.filter((collection) => collection.slug !== "users") ||
          []),
        modifiedUsersCollection,
      ];

      if (pluginOptions.paymentMethods.allowedDropIns) {
        collections.push(dropInsCollection);
      }
    }

    config.collections = collections;

    return config;
  };

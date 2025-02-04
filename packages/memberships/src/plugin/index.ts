import type { Config, Plugin } from "payload";

import { modifyUsersCollection } from "../collections/users";

import { plansCollection } from "../collections/plans";

import { plansProxy } from "../endpoints/plans";
import { subscriptionsProxy } from "../endpoints/subscriptions";

import { createCheckoutSession } from "../endpoints/create-checkout-session";
import { createCustomerPortal } from "../endpoints/create-customer-portal";

import { MembershipsPluginConfig } from "../types";

import { subscriptionsCollection } from "../collections/subscriptions";

export const membershipsPlugin =
  (pluginOptions: MembershipsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
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
      path: "/stripe/plans",
      method: "get",
      handler: plansProxy,
    });

    endpoints.push({
      path: "/stripe/subscriptions",
      method: "get",
      handler: subscriptionsProxy,
    });

    endpoints.push({
      path: "/stripe/create-checkout-session",
      method: "post",
      handler: createCheckoutSession,
    });

    endpoints.push({
      path: "/stripe/create-customer-portal",
      method: "post",
      handler: createCustomerPortal,
    });

    collections.push(plansCollection);
    collections.push(subscriptionsCollection);

    config.collections = collections;
    config.endpoints = endpoints;

    return config;
  };

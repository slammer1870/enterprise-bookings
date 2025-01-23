import type { Config, Plugin } from "payload";

import { modifyUsersCollection } from "../collections/users";
import { dropInsCollection } from "../collections/drop-ins";

import { customersProxy } from "../endpoints/customers";

export const paymentsPlugin = (): Plugin => (incomingConfig: Config) => {
  let config = { ...incomingConfig };

  const pluginConfig = config.custom?.plugins?.find(
    (p: any) => p.name === "payments"
  );

  if (!pluginConfig) {
    throw new Error("Payments plugin is not enabled");
  }

  const stripeSecretKey = pluginConfig?.options?.stripeSecretKey;

  if (!stripeSecretKey) {
    throw new Error("Stripe secret key is not set");
  }

  const collections = config.collections || [];

  const endpoints = config.endpoints || [];

  const usersCollection = collections.find(
    (collection) => collection.slug === "users"
  );

  if (!usersCollection) {
    throw new Error("Users collection not found");
  }

  collections.push(modifyUsersCollection(usersCollection));

  endpoints.push({
    path: "/customers",
    method: "get",
    handler: customersProxy,
  });

  const dropIn = pluginConfig?.options?.dropIn;

  if (dropIn) {
    collections.push(dropInsCollection);
  }

  config.collections = collections;
  config.endpoints = endpoints;
  return config;
};

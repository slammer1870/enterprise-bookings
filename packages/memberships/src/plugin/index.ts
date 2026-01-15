import type {
  Config,
  Plugin,
  GroupField,
  CollectionSlug,
  Field,
  NamedGroupField,
} from "payload";

import { modifyUsersCollection } from "../collections/users";

import { generatePlansCollection } from "../collections/plans";
import { generateSubscriptionCollection } from "../collections/subscriptions";

import { plansProxy } from "../endpoints/plans";
import { subscriptionsProxy } from "../endpoints/subscriptions";

import { createCheckoutSession } from "../endpoints/create-checkout-session";
import { createCustomerPortal } from "../endpoints/create-customer-portal";
import { syncStripeSubscriptionsEndpoint } from "../endpoints/sync-stripe-subscriptions";

import { MembershipsPluginConfig } from "../types";

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

    endpoints.push({
      path: "/stripe/sync-stripe-subscriptions",
      method: "post",
      handler: syncStripeSubscriptionsEndpoint,
    });

    const plansCollection = generatePlansCollection(pluginOptions);

    collections.push(generateSubscriptionCollection(pluginOptions));
    collections.push(plansCollection);

    pluginOptions.paymentMethodSlugs?.map((slug) => {
      const collection = collections.find(
        (collection) => collection.slug === slug
      );

      if (!collection) {
        throw new Error(`Collection ${slug} not found`);
      }

      const paymentMethodsField = collection.fields.find(
        (field) =>
          field.type === "group" &&
          "name" in field &&
          field.name === "paymentMethods"
      ) as GroupField;

      if (!paymentMethodsField) {
        collection.fields.push({
          name: "paymentMethods",
          label: "Payment Methods",
          type: "group",
          fields: [
            {
              name: "allowedPlans",
              type: "relationship",
              relationTo: "plans" as CollectionSlug,
              hasMany: true,
            },
          ],
        });
      } else {
        const hasAllowedPlans = paymentMethodsField.fields.some(
          (field) => "name" in field && field.name === "allowedPlans"
        );
        if (!hasAllowedPlans) {
          paymentMethodsField.fields.push({
            name: "allowedPlans",
            type: "relationship",
            relationTo: "plans" as CollectionSlug,
            hasMany: true,
          });
        }
      }

      const joinFieldName = `${slug}PaymentMethods`;
      const hasJoinField = plansCollection.fields.some(
        (field) => "name" in field && field.name === joinFieldName
      );
      if (!hasJoinField) {
        plansCollection.fields.push({
          name: joinFieldName,
          label: `${collection.labels?.singular} Payment Methods`,
          type: "join",
          collection: slug as CollectionSlug,
          on: "paymentMethods.allowedPlans",
          hasMany: true,
        });
      }

      collections = collections.filter(
        (collection) => collection.slug !== "plans"
      );

      collections.push(plansCollection);
    });

    config.collections = collections;
    config.endpoints = endpoints;

    return config;
  };

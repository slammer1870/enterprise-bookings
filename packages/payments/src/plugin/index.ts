import type { Config, Plugin, CollectionSlug, GroupField, NamedGroupField } from "payload";

import { modifyUsersCollection } from "../collections/users";
import { dropInsCollection } from "../collections/drop-ins";

import { customersProxy } from "../endpoints/customers";

import { PaymentsPluginConfig } from "../types";
import { createPaymentIntent } from "../endpoints/create-payment-intent";
import { transactionsCollection } from "../collections/transactions";

export const paymentsPlugin =
  (pluginOptions: PaymentsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    let collections = [...(config.collections || [])];

    const endpoints = config.endpoints || [];

    if (pluginOptions.enableDropIns) {
      const dropIns = dropInsCollection(pluginOptions);

      collections = collections.filter(
        (collection) => collection.slug !== "drop-ins"
      );

      pluginOptions.paymentMethodSlugs?.map((slug) => {
        const collection = collections.find(
          (collection) => collection.slug === slug
        );

        if (!collection) {
          throw new Error(`Collection ${slug} not found`);
        }

        const paymentMethodsField = collection.fields.find(
          (field): field is NamedGroupField => 
            field.type === "group" && "name" in field && field.name === "paymentMethods"
        );

        if (!paymentMethodsField) {
          collection.fields.push({
            name: "paymentMethods",
            label: "Payment Methods",
            type: "group",
            fields: [
              {
                name: "allowedDropIn",
                label: "Allowed Drop In",
                type: "relationship",
                relationTo: "drop-ins" as CollectionSlug,
                hasMany: false,
              },
            ],
          });
        } else {
          paymentMethodsField.fields.push({
            name: "allowedDropIn",
            label: "Allowed Drop In",
            type: "relationship",
            relationTo: "drop-ins" as CollectionSlug,
            hasMany: false,
          });
        }

        dropIns.fields.push({
          name: `${slug}PaymentMethods`,
          label: `${collection.labels?.singular} Payment Methods`,
          type: "join",
          collection: slug as CollectionSlug,
          on: "paymentMethods.allowedDropIn",
          hasMany: false,
        });
      });

      collections.push(dropIns);
    }

    if (pluginOptions.acceptedPaymentMethods?.includes("card")) {
      const usersCollection = collections.find(
        (collection) => collection.slug === "users"
      );

      if (!usersCollection) {
        throw new Error("Users collection not found");
      }

      collections = collections.filter((collection) => collection.slug !== "users");
      collections.push(modifyUsersCollection(usersCollection));

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

    collections = collections.filter(
      (collection) => collection.slug !== "transactions"
    );
    collections.push(transactionsCollection);

    config.collections = collections;
    config.endpoints = endpoints;

    return config;
  };

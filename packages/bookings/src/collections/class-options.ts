import type { CollectionConfig, CollectionSlug, Config, Field } from "payload";

import { PluginTypes } from "../types";

export const classOptionsCollection = (
  pluginOptions: PluginTypes,
  incomingConfig: Config
): CollectionConfig => {
  const config: CollectionConfig = {
    slug: "class-options",
    labels: {
      singular: "Class Option",
      plural: "Class Options",
    },
    admin: {
      group: "Bookings",
      useAsTitle: "name",
    },
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
      },
      {
        name: "places",
        label: "Places",
        admin: {
          description: "How many people can book this class option?",
        },
        type: "number",
        required: true,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
    ],
  };

  if (pluginOptions.childrenEnabled) {
    config.fields.push({
      name: "type",
      label: "Class Type",
      type: "select",
      options: ["adult", "child"],
      defaultValue: "adult",
      required: true,
    });
  }

  if (pluginOptions.paymentsEnabled) {
    const paymentMethods: Field = {
      name: "paymentMethods",
      label: "Payment Methods",
      type: "group",
      fields: [],
    };
    if (
      incomingConfig.custom?.plugins?.find((p: any) => p.name === "payments")
        ?.options?.dropIns
    ) {
      paymentMethods.fields.push({
        name: "allowedDropIns",
        label: "Allowed Drop Ins",
        type: "relationship",
        relationTo: "drop-ins" as CollectionSlug,
        hasMany: true,
        required: false,
      });
    }

    config.fields.push(paymentMethods);
  }

  return config;
};

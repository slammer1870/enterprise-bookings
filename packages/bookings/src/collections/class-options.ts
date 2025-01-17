import type { CollectionConfig, CollectionSlug, Field } from "payload";
import { PluginTypes } from "../types";

import { dropInsCollection } from "../collections/payments/drop-ins";

export const classOptionsCollection = (
  pluginOptions: PluginTypes
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

  if (pluginOptions.paymentMethods.stripeSecretKey) {
    const paymentMethods: Field = {
      name: "paymentMethods",
      label: "Payment Methods",
      type: "group",
      fields: [],
    };
    if (pluginOptions.paymentMethods.allowedDropIns) {
      paymentMethods.fields.push({
        name: "allowedDropIns",
        label: "Allowed Drop Ins",
        type: "relationship",
        relationTo: dropInsCollection.slug as CollectionSlug,
        hasMany: true,
        required: false,
      });
    }

    config.fields.push(paymentMethods);
  }

  return config;
};

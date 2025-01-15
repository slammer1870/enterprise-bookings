import type { CollectionConfig, CollectionSlug } from "payload";
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

  if (
    pluginOptions.paymentMethods.stripeSecretKey &&
    pluginOptions.paymentMethods.allowedDropIns
  ) {
    config.fields.push({
      name: "dropIn",
      label: "Drop In",
      type: "relationship",
      relationTo: dropInsCollection.slug as CollectionSlug,
      hasMany: true,
      required: true,
    });
  }

  return config;
};

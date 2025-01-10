import type { CollectionConfig } from "payload";
import { PluginTypes } from "../types";

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

  if (pluginOptions.paymentsEnabled) {
    config.fields.push({
      name: "paymentMethods",
      label: "Payment Methods",
      type: "group",
      fields: [
        {
          name: "allowedDropIns",
          label: "Allowed Drop Ins",
          type: "relationship",
          hasMany: true,
          relationTo: "drop-ins",
          admin: {
            description:
              "Select the drop ins that are allowed for this class option.",
            position: "sidebar",
          },
        },
        {
          name: "allowedPlans",
          label: "Allowed Plans",
          type: "relationship",
          relationTo: "plans",
          hasMany: true,
          admin: {
            description:
              "Select the subscriptionsthat are allowed for this class option.",
            position: "sidebar",
          },
        },
      ],
    });
  }

  return config;
};

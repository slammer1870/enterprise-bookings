import type { CollectionConfig, CollectionSlug, Config } from "payload";
import { BookingsPluginConfig } from "../../types";

export const dropInsCollection = (
  pluginOptions: BookingsPluginConfig
): CollectionConfig => {
  const dropInConfig: CollectionConfig = {
    slug: "drop-ins",
    labels: {
      singular: "Drop In",
      plural: "Drop Ins",
    },
    admin: {
      useAsTitle: "name",
      group: "Products",
    },
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
      },
      {
        name: "price",
        label: "Price",
        type: "number",
        required: true,
      },
      {
        name: "priceType",
        label: "Price Type",
        type: "select",
        options: ["trial", "normal"],
        defaultValue: "normal",
        required: true,
      },
      {
        name: "active",
        label: "Active",
        type: "checkbox",
        defaultValue: true,
      },
    ],
  };

  if (pluginOptions.paymentsMethods?.dropIns) {
    dropInConfig.fields.push({
      name: "allowedClasses",
      label: "Allowed Classes",
      type: "join",
      collection: "class-options" as CollectionSlug,
      on: "paymentMethods.allowedDropIns",
    });
  }

  return dropInConfig;
};

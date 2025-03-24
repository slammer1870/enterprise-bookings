import type { CollectionConfig, CollectionSlug, GroupField } from "payload";

import { BookingsPluginConfig } from "../types";
import { checkRole } from "@repo/shared-utils/src/check-role";
import type { User } from "@repo/shared-types/";
export const classOptionsCollection = (
  pluginOptions: BookingsPluginConfig
): CollectionConfig => {
  const config: CollectionConfig = {
    slug: "class-options",
    labels: {
      singular: "Class Option",
      plural: "Class Options",
    },
    access: {
      read: () => true,
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
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
        unique: true,
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

  if (pluginOptions.paymentMethods) {
    const paymentMethods: GroupField = {
      name: "paymentMethods",
      label: "Payment Methods",
      type: "group",
      fields: [],
    };

    config.fields.push(paymentMethods);

    if (pluginOptions.paymentMethods?.dropIns) {
      paymentMethods.fields.push({
        name: "allowedDropIns",
        label: "Allowed Drop Ins",
        type: "relationship",
        relationTo: "drop-ins" as CollectionSlug,
        hasMany: false,
        required: false,
      });
    }

    if (pluginOptions.paymentMethods?.plans) {
      paymentMethods.fields.push({
        name: "allowedPlans",
        label: "Allowed Plans",
        type: "relationship",
        relationTo: "plans" as CollectionSlug,
        hasMany: true,
        required: false,
      });
    }
  }

  return config;
};

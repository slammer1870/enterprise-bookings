import type {
  CollectionAdminOptions,
  CollectionConfig,
  Field,
  Labels,
} from "payload";

import { BookingsPluginConfig } from "../types";

import { checkRole } from "@repo/shared-utils";

import type { User, AccessControls, HooksConfig } from "@repo/shared-types/";

const defaultFields: Field[] = [
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
];

const defaultLabels: Labels = {
  singular: "Class Option",
  plural: "Class Options",
};

const defaultAccess: AccessControls = {
  read: () => true,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  useAsTitle: "name",
};

const defaultHooks: HooksConfig = {};

export const generateClassOptionsCollection = (
  config: BookingsPluginConfig
) => {
  const classOptionsConfig: CollectionConfig = {
    ...(config?.classOptionsOverrides || {}),
    slug: "class-options",
    defaultSort: "updatedAt",
    labels: {
      ...(config?.classOptionsOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.classOptionsOverrides?.access &&
      typeof config?.classOptionsOverrides?.access === "function"
        ? config.classOptionsOverrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(config?.classOptionsOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.classOptionsOverrides?.hooks &&
      typeof config?.classOptionsOverrides?.hooks === "function"
        ? config.classOptionsOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      config?.classOptionsOverrides?.fields &&
      typeof config?.classOptionsOverrides?.fields === "function"
        ? config.classOptionsOverrides.fields({ defaultFields })
        : defaultFields,
  };

  return classOptionsConfig;
};

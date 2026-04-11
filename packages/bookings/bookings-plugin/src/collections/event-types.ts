import type {
  CollectionAdminOptions,
  CollectionConfig,
  Field,
  Labels,
} from "payload";

import { BookingsPluginConfig } from "../types";

import { checkRole } from "@repo/shared-utils";

import type { User, AccessControls, HooksConfig } from "@repo/shared-types/";

import type { BookingCollectionSlugs } from "../resolve-slugs";

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
  create: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
  update: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
  delete: ({ req: { user } }) =>
    checkRole(["super-admin", "admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  useAsTitle: "name",
};

const defaultHooks: HooksConfig = {};

export const generateEventTypesCollection = (
  config: BookingsPluginConfig,
  slugs: BookingCollectionSlugs,
) => {
  const overrides = config?.eventTypesOverrides;
  const eventTypesConfig: CollectionConfig = {
    ...(overrides || {}),
    slug: slugs.eventTypes,
    defaultSort: "updatedAt",
    labels: {
      ...(overrides?.labels || defaultLabels),
    },
    access: {
      ...(overrides?.access && typeof overrides?.access === "function"
        ? overrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(overrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(overrides?.hooks && typeof overrides?.hooks === "function"
        ? overrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      overrides?.fields && typeof overrides?.fields === "function"
        ? overrides.fields({ defaultFields })
        : defaultFields,
  };

  return eventTypesConfig;
};

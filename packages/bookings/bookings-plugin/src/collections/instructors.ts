import type {
  CollectionAdminOptions,
  CollectionConfig,
  Field,
  Labels,
} from "payload";

import { BookingsPluginConfig } from "../types";

import { checkRole } from "@repo/shared-utils/src/check-role";

import type { User, AccessControls, HooksConfig } from "@repo/shared-types/";

const defaultFields: Field[] = [
  {
    name: "user",
    label: "User",
    type: "relationship",
    relationTo: "users",
    required: true,
    unique: true,
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
  },
  {
    name: "image",
    label: "Image",
    type: "upload",
    relationTo: "media",
    required: false,
  },
  {
    name: "active",
    label: "Active",
    type: "checkbox",
    defaultValue: true,
    admin: {
      position: "sidebar",
      description: "Whether this instructor is active and can be assigned to lessons",
    },
  },
];

const defaultLabels: Labels = {
  singular: "Instructor",
  plural: "Instructors",
};

const defaultAccess: AccessControls = {
  read: ({ req: { user } }) => {
    // Admins can see all instructors
    if (checkRole(["admin"], user as User | null)) {
      return true;
    }
    // Regular users can only see active instructors
    return {
      active: {
        equals: true,
      },
    };
  },
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

const defaultAdmin: CollectionAdminOptions = {
  group: "Bookings",
  useAsTitle: "user",
};

const defaultHooks: HooksConfig = {};

export const generateInstructorCollection = (
  config: BookingsPluginConfig
) => {
  const instructorConfig: CollectionConfig = {
    ...(config?.instructorOverrides || {}),
    slug: "instructors",
    labels: {
      ...(config?.instructorOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.instructorOverrides?.access &&
      typeof config?.instructorOverrides?.access === "function"
        ? config.instructorOverrides.access({ defaultAccess })
        : defaultAccess),
    },
    admin: {
      ...(config?.instructorOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.instructorOverrides?.hooks &&
      typeof config?.instructorOverrides?.hooks === "function"
        ? config.instructorOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      config?.instructorOverrides?.fields &&
      typeof config?.instructorOverrides?.fields === "function"
        ? config.instructorOverrides.fields({ defaultFields })
        : defaultFields,
  };

  return instructorConfig;
};


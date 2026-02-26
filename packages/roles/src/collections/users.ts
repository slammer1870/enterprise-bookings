import { CollectionConfig } from "payload";

import { checkRole } from "@repo/shared-utils";

import { RolesPluginConfig } from "../types";

export const modifyUsersCollection = (
  existingCollectionConfig: CollectionConfig,
  pluginOptions: RolesPluginConfig
): CollectionConfig => {
  const fields = existingCollectionConfig.fields || [];

  const roles = pluginOptions.roles || [];
  const firstUserRole = pluginOptions.firstUserRole || "admin";
  const defaultRole = pluginOptions.defaultRole || "user";

  if (!roles.includes(defaultRole)) {
    roles.push(defaultRole);
  }

  if (!roles.includes(firstUserRole)) {
    roles.push(firstUserRole);
  }

  fields.push({
    name: "roles",
    type: "select",
    label: "Roles",
    options: roles.map((role) => role),
    defaultValue: [defaultRole],
    hasMany: true,
    access: {
      create: ({ req: { user } }) => checkRole([firstUserRole], user as any),
      read: ({ req: { user } }) => checkRole([firstUserRole], user as any),
      update: ({ req: { user } }) => checkRole([firstUserRole], user as any),
    },
    hooks: {
      beforeChange: [
        async ({ value, operation, req }) => {
          if (operation === "create") {
            const users = await req.payload.find({
              collection: "users",
              depth: 0,
              // Only need to know whether *any* user exists; avoid selecting full docs
              // (which can join plugin-backed tables that may not exist yet).
              limit: 1,
              select: {
                id: true,
              },
            });
            if (users.totalDocs === 0) {
              // if `admin` not in array of values, add it
              if (!(value || []).includes(firstUserRole)) {
                return [...(value || []), firstUserRole];
              }
            }
          }

          return value;
        },
      ],
    },
  });

  return {
    ...existingCollectionConfig,
    fields,
  };
};

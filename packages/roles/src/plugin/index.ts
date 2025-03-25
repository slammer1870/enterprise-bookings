import { Config, Plugin } from "payload";

import { RolesPluginConfig } from "../types";

import { modifyUsersCollection } from "../collections/users";

export const rolesPlugin =
  (pluginOptions: RolesPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    let config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    let collections = config.collections || [];

    const usersCollection = collections.find(
      (collection) => collection.slug === "users"
    );

    if (!usersCollection) {
      throw new Error("Users collection not found");
    }

    collections = [
      ...(collections.filter((collection) => collection.slug !== "users") ||
        []),
      modifyUsersCollection(usersCollection, pluginOptions),
    ];

    config.collections = collections;

    // Add an onInit hook to check for existing users and assign admin role if needed
    const existingOnInit = config.onInit;
    config.onInit = async (payload) => {
      // Run existing onInit if available
      if (existingOnInit) {
        await existingOnInit(payload);
      }

      // Check if there are any users
      const users = await payload.find({
        collection: "users",
        depth: 0,
        limit: 1,
        sort: "createdAt", // Sort by creation date to get the oldest user
      });

      // If at least one user exists, assign admin role to the first created user
      if (users.totalDocs > 0) {
        const firstUser = users.docs[0];

        if (!firstUser) {
          throw new Error("No users found");
        }

        // Check if the user doesn't have the admin role
        if (firstUser?.roles && !firstUser.roles.includes("admin")) {
          // Add the admin role to the first user
          await payload.update({
            collection: "users",
            id: firstUser.id,
            data: {
              roles: [...(firstUser?.roles || []), "admin"],
            },
          });

          payload.logger.info(
            `Assigned admin role to the first user (ID: ${firstUser?.id})`
          );
        }
      }
    };

    return config;
  };

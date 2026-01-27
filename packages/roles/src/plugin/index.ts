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
      
      // Skip database operations during build time to avoid schema mismatch errors
      // Next.js build process may initialize Payload but database schema might not be ready
      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                         (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URI);
      
      if (isBuildTime) {
        payload.logger.info('Skipping rolesPlugin onInit during build time');
        return;
      }
      
      try {
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
          if (!firstUser?.roles?.includes("admin")) {
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
      } catch (error) {
        // During build, database errors are expected - log but don't fail
        // The error is likely due to schema mismatch (e.g., users_role table doesn't exist)
        if (isBuildTime || process.env.NODE_ENV === 'production') {
          const errorMessage = error instanceof Error ? error.message : String(error);
          payload.logger.warn(`rolesPlugin onInit skipped due to build-time database error: ${errorMessage}`);
        } else {
          payload.logger.error(error);
        }
      }
    };

    return config;
  };

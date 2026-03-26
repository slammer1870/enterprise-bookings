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

    const allowedRoles = ["admin", "tenant-admin", "user"] as const;
    type AllowedRole = (typeof allowedRoles)[number];
    type UserForOnInit = { id: string | number; roles?: AllowedRole[] };

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
      const isBuildTime =
        process.env.NEXT_PHASE === "phase-production-build" ||
        (process.env.NODE_ENV === "production" && !process.env.DATABASE_URI);

      if (isBuildTime) {
        payload.logger.info("Skipping rolesPlugin onInit during build time");
        return;
      }

      const firstUserRole: AllowedRole = allowedRoles.includes(
        pluginOptions.firstUserRole as AllowedRole
      )
        ? (pluginOptions.firstUserRole as AllowedRole)
        : "admin";

      try {
        // Check if there are any users
        const users = await payload.find({
          collection: "users",
          depth: 0,
          limit: 1,
          sort: "createdAt", // Sort by creation date to get the oldest user
          // Be defensive: selecting the full doc can join optional plugin-backed tables.
          // During rolling deploys / partial migrations, those tables may not exist yet.
          select: {
            roles: true,
          },
        });

        // If at least one user exists, assign admin role to the first created user
        if (users.totalDocs > 0) {
          const firstUser = users.docs[0] as unknown as UserForOnInit | undefined;

          if (!firstUser) {
            throw new Error("No users found");
          }

          const userRoles: AllowedRole[] = Array.isArray(firstUser.roles)
            ? firstUser.roles
            : [];

          // Check if the user doesn't have the admin role
          if (!userRoles.includes(firstUserRole)) {
            // Add the role to the first user.
            // Payload v3 local operations expect a `req` shape; omitting it can crash in some init flows.
            await payload.update({
              collection: "users",
              id: firstUser.id,
              data: {
                roles: [...userRoles, firstUserRole],
              },
              overrideAccess: true,
              // Minimal local req object; ensures payload internals can resolve collections.
              // (onInit runs outside a request/response cycle)
              req: { payload } as any,
            });

            payload.logger.info(
              `Assigned admin role to the first user (ID: ${firstUser?.id})`
            );
          }
        }
      } catch (error) {
        // During build, database errors are expected - log but don't fail
        // The error is likely due to schema mismatch (e.g., users_role table doesn't exist)
        if (isBuildTime || process.env.NODE_ENV === "production") {
          const errorMessage = error instanceof Error ? error.message : String(error);
          payload.logger.warn(
            `rolesPlugin onInit skipped due to build-time database error: ${errorMessage}`
          );
        } else {
          payload.logger.error(error);
        }
      }
    };

    return config;
  };

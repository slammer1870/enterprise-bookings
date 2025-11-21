import { AuthStrategy, type Access, type CollectionConfig, type PayloadRequest } from "payload";
import { User } from "@repo/shared-types";

import { PluginTypes } from "../types";

import { sendMagicLink } from "../endpoints/send-magic-link";
import { verifyMagicLink } from "../endpoints/verify-magic-link";

import { name } from "../fields/name";
import { email } from "../fields/email";

import { magicLink } from "../strategies/magic-link";
import { register } from "../endpoints/register";

import { adminOrUser } from "../access/admin-or-user";
import { checkRole } from "@repo/shared-utils/src/check-role";

// Constants
const DEFAULT_MAX_LOGIN_ATTEMPTS = 20;
const DEFAULT_TOKEN_EXPIRATION = 31536000; // 1 year in seconds

// Helper functions
const findFieldByName = (fields: CollectionConfig["fields"], fieldName: string) => {
  return fields?.find(
    (field) => "name" in field && field.name === fieldName
  );
};

const addFieldIfNotExists = (
  fields: CollectionConfig["fields"],
  fieldToAdd: CollectionConfig["fields"][number]
) => {
  const fieldName = "name" in fieldToAdd ? fieldToAdd.name : undefined;
  if (!fieldName || !findFieldByName(fields, fieldName)) {
    return [...(fields || []), fieldToAdd];
  }
  return fields;
};

const getExistingStrategies = (
  auth: CollectionConfig["auth"]
): AuthStrategy[] => {
  if (typeof auth === "boolean" || auth === undefined) {
    return [];
  }
  if (Array.isArray(auth.strategies)) {
    return auth.strategies;
  }
  return [];
};

const getExistingAuthConfig = (
  auth: CollectionConfig["auth"]
): Exclude<CollectionConfig["auth"], boolean | undefined> => {
  if (typeof auth === "object" && auth !== null) {
    return auth;
  }
  return {} as Exclude<CollectionConfig["auth"], boolean | undefined>;
};

const adminOnly: Access = ({ req: { user } }) =>
  checkRole(["admin"], user as unknown as User);

const adminOnlyFunction = ({ req: { user } }: { req: PayloadRequest }) =>
  checkRole(["admin"], user as unknown as User);

const createDefaultAccess = (
  existingAccess: CollectionConfig["access"]
): CollectionConfig["access"] => {
  const existing = existingAccess || {};
  return {
    ...existing,
    ...(existing.create === undefined && { create: () => true }),
    ...(existing.read === undefined && { read: adminOrUser }),
    ...(existing.update === undefined && { update: adminOnly }),
    ...(existing.delete === undefined && { delete: adminOnly }),
    ...(existing.admin === undefined && { admin: adminOnlyFunction }),
  };
};

const createDefaultAuthConfig = (
  existingAuth: Exclude<CollectionConfig["auth"], boolean | undefined>,
  strategies: AuthStrategy[]
): Exclude<CollectionConfig["auth"], boolean | undefined> => {
  const isObject = typeof existingAuth === "object" && existingAuth !== null;
  const baseConfig = isObject ? existingAuth : {};
  
  // Safely check and set defaults only if properties are undefined
  const authConfig = baseConfig as Record<string, unknown>;

  return {
    ...baseConfig,
    strategies,
    ...(authConfig.maxLoginAttempts === undefined && {
      maxLoginAttempts: DEFAULT_MAX_LOGIN_ATTEMPTS,
    }),
    ...(authConfig.tokenExpiration === undefined && {
      tokenExpiration: DEFAULT_TOKEN_EXPIRATION,
    }),
  } as Exclude<CollectionConfig["auth"], boolean | undefined>;
};

export const modifyAuthCollection = (
  pluginOptions: PluginTypes,
  existingCollectionConfig: CollectionConfig
): CollectionConfig => {
  // Modify fields
  let fields = existingCollectionConfig.fields;
  fields = addFieldIfNotExists(fields, name);
  fields = addFieldIfNotExists(fields, email);

  // Modify strategies
  const existingStrategies = getExistingStrategies(
    existingCollectionConfig.auth
  );
  const strategies = [...existingStrategies, magicLink(pluginOptions)];

  // Modify endpoints
  const endpoints = [
    ...(existingCollectionConfig.endpoints || []),
    register(pluginOptions),
    sendMagicLink(pluginOptions),
    verifyMagicLink(pluginOptions),
  ];

  // Modify access
  const access = createDefaultAccess(existingCollectionConfig.access);

  // Modify auth
  const existingAuthConfig = getExistingAuthConfig(
    existingCollectionConfig.auth
  );
  const auth = createDefaultAuthConfig(existingAuthConfig, strategies);

  return {
    ...existingCollectionConfig,
    fields,
    endpoints,
    access,
    auth,
  };
};


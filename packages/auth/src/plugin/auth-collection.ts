import { AuthStrategy, type CollectionConfig } from "payload";
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

export const modifyAuthCollection = (
  pluginOptions: PluginTypes,
  existingCollectionConfig: CollectionConfig
): CollectionConfig => {
  // /////////////////////////////////////
  // modify fields
  // /////////////////////////////////////

  // add name field
  const fields = existingCollectionConfig.fields || [];
  const existingNameField = fields.find(
    (field) => "name" in field && field.name === "name"
  );
  if (!existingNameField) {
    fields.push(name);
  }
  // add email field
  const existingEmailField = fields.find(
    (field) => "name" in field && field.name === "email"
  );
  if (!existingEmailField) {
    fields.push(email);
  }

  // /////////////////////////////////////
  // modify strategies
  // /////////////////////////////////////

  let strategies: AuthStrategy[] = [];
  if (
    typeof existingCollectionConfig.auth === "boolean" ||
    existingCollectionConfig.auth === undefined
  ) {
    strategies = [];
  } else if (Array.isArray(existingCollectionConfig.auth.strategies)) {
    strategies = existingCollectionConfig.auth.strategies || [];
  }
  strategies.push(magicLink(pluginOptions));

  // /////////////////////////////////////
  // modify endpoints
  // /////////////////////////////////////
  const endpoints = existingCollectionConfig.endpoints || [];
  endpoints.push(register(pluginOptions));
  endpoints.push(sendMagicLink(pluginOptions));
  endpoints.push(verifyMagicLink(pluginOptions));

  // /////////////////////////////////////
  // modify access
  // /////////////////////////////////////

  const access = existingCollectionConfig.access || {};
  access.create = () => true;
  access.read = adminOrUser;
  access.admin = ({ req: { user } }) => checkRole(["admin"], user as User);

  return {
    ...existingCollectionConfig,
    fields,
    endpoints,
    auth: {
      ...(typeof existingCollectionConfig.auth === "object" &&
      existingCollectionConfig.auth !== null
        ? existingCollectionConfig.auth
        : {}),
      strategies,
      maxLoginAttempts: 5,
    },
    access,
  };
};

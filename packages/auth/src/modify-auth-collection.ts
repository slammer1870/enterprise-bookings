import { AuthStrategy, type CollectionConfig } from "payload";

import { PluginTypes } from "./types";

import { sendMagicLink } from "./endpoints/send-magic-link";
import { verifyMagicLink } from "./endpoints/verify-magic-link";

import { name } from "./fields/name";
import { email } from "./fields/email";

import { magicLink } from "./strategies/magic-link";

export const modifyAuthCollection = (
  pluginOptions: PluginTypes,
  existingCollectionConfig: CollectionConfig
): CollectionConfig => {
  // /////////////////////////////////////
  // modify fields
  // /////////////////////////////////////

  // add name fields
  const fields = existingCollectionConfig.fields || [];
  const existingNameField = fields.find(
    (field) => "name" in field && field.name === "name"
  );
  if (!existingNameField) {
    fields.push(name);
  }

  // add email field if disableLocalStrategy is set
  // and we don't have an email field
  if (
    typeof existingCollectionConfig.auth !== "boolean" &&
    existingCollectionConfig.auth !== undefined &&
    existingCollectionConfig.auth.disableLocalStrategy === true &&
    fields.every((field: any) => field.name !== "email")
  ) {
    const existingEmailField = fields.find(
      (field) => "name" in field && field.name === "email"
    );
    if (!existingEmailField) {
      fields.push(email);
    }
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
  strategies.push(magicLink);

  // /////////////////////////////////////
  // modify endpoints
  // /////////////////////////////////////
  const endpoints = existingCollectionConfig.endpoints || [];
  endpoints.push(sendMagicLink(pluginOptions));
  endpoints.push(verifyMagicLink(pluginOptions));

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
    },
  };
};

import { type CollectionConfig } from "payload";

import { register } from "../endpoints/register";
import { sendMagicLink } from "../endpoints/send-magic-link";
import { verifyMagicLink } from "../endpoints/verify-magic-link";

import { magicLink } from "../strategies/magic-link";

import { name } from "../fields/name";
import { email } from "../fields/email";
import { image } from "../fields/image";

import { PluginTypes } from "../types";

export const Users = (pluginOptions: PluginTypes): CollectionConfig => ({
  slug: "users",
  admin: {
    defaultColumns: ["name", "email"],
    useAsTitle: "name",
  },
  auth: {
    tokenExpiration: 604800,
    strategies: [magicLink],
  },
  fields: [name, email, image],
  endpoints: [
    {
      path: "/register",
      method: "post",
      handler: register,
    },
    sendMagicLink(pluginOptions),
    verifyMagicLink(pluginOptions),
  ],
});

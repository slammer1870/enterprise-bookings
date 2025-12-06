import {
  AuthStrategy,
  AuthStrategyResult,
  CollectionSlug,
  Payload,
} from "payload";

import jwt from "jsonwebtoken";

import type { PluginTypes } from "../types";

export const magicLink = (pluginOptions: PluginTypes): AuthStrategy => ({
  name: "magic-link",
  authenticate: async ({
    payload,
    headers,
  }: {
    payload: Payload;
    headers: Headers;
  }) => {
    const heads = new Headers(headers);

    const token = heads.get("token") as string;

    if (!token) {
      return {
        user: null,
      };
    }

    const authCollectionSlug = (pluginOptions.authCollection ||
      "users") as CollectionSlug;

    try {
      const decoded = jwt.verify(token, payload.secret) as {
        id: string;
      };

      // Create a Payload login response
      const user = await payload.findByID({
        collection: authCollectionSlug,
        id: decoded.id,
      });

      return {
        user: user as unknown as AuthStrategyResult["user"],
      };
    } catch (error) {
      console.log("error", error);
    }

    return {
      user: null,
    };
  },
});

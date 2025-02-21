import {
  APIError,
  CollectionSlug,
  Endpoint,
  generatePayloadCookie,
} from "payload";

import jwt from "jsonwebtoken";

import { PluginTypes } from "../types";

import { User } from "@repo/shared-types";

export const verifyMagicLink = (pluginOptions: PluginTypes): Endpoint => ({
  path: "/verify-magic-link",
  method: "get",
  handler: async (req): Promise<Response> => {
    const { token, callbackUrl } = req.query;

    if (!token) {
      throw new APIError("Token is required", 400);
    }

    req.headers.set("token", token as string);

    const authCollectionSlug = (pluginOptions.authCollection ||
      "users") as CollectionSlug;

    const collectionConfig =
      req.payload.collections[authCollectionSlug]?.config;

    try {
      const magicLinkStrategyIndex = req.payload.authStrategies.findIndex(
        (strategy) => strategy.name === "magic-link"
      );

      const magicLinkStrategy =
        req.payload.authStrategies?.[magicLinkStrategyIndex];

      const authenticated = await magicLinkStrategy?.authenticate({
        payload: req.payload,
        headers: req.headers,
      });

      const user = authenticated?.user as User;

      if (!user) {
        throw new APIError("Invalid token", 400);
      }

      const fieldsToSign = {
        id: user.id,
        email: user.email,
        collection: authCollectionSlug,
      };

      const token = jwt.sign(fieldsToSign, req.payload.secret, {
        expiresIn: collectionConfig?.auth?.tokenExpiration,
      });

      if (!collectionConfig) {
        throw new APIError("Collection configuration is required", 500);
      }

      const cookie = generatePayloadCookie({
        collectionAuthConfig: collectionConfig.auth,
        cookiePrefix: req.payload.config.cookiePrefix,
        payload: req.payload,
        token,
      });

      // /////////////////////////////////////
      // success redirect
      // /////////////////////////////////////

      const url: string = callbackUrl ? (callbackUrl as string) : "/dashboard";

      return new Response(null, {
        headers: {
          "Set-Cookie": cookie,
          Location: url,
        },
        status: 302,
      });
    } catch (error) {
      console.log("Verify Magic Link Error", error);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        headers: {
          Location: "/login",
        },
        status: 302,
      });
    }
  },
});

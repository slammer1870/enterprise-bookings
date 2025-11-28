import { APIError, CollectionSlug, Endpoint } from "payload";

import { generatePasswordSaltHash } from "../utils/password";

import crypto from "crypto";

import type { PluginTypes } from "../types";

export const register = (pluginOptions: PluginTypes): Endpoint => ({
  path: "/register",
  method: "post",
  handler: async (req): Promise<Response> => {
    if (!req.json) {
      throw new APIError("Invalid request body", 400);
    }

    const { email, name } = await req.json();

    if (!email || !name) {
      throw new APIError("Invalid request body", 400);
    }

    const authCollectionSlug = (pluginOptions.authCollection ||
      "users") as CollectionSlug;

    const existingUser = await req.payload.find({
      collection: authCollectionSlug,
      where: {
        email: {
          equals: email.toLowerCase(),
        },
      },
    });

    if (existingUser.docs.length > 0) {
      throw new APIError("User already exists", 400);
    }

    try {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const { hash, salt } = await generatePasswordSaltHash({
        password: randomPassword,
      });

      const user = await req.payload.create({
        collection: authCollectionSlug,
        data: {
          name: name,
          email: email.toLowerCase(),
          hash: hash,
          salt: salt,
          password: randomPassword,
        },
        showHiddenFields: false,
      });

      return new Response(JSON.stringify(user), { status: 200 }); // Ensure to return a Response object
    } catch (error) {
      console.log("error", error);
      throw new APIError("Error creating user", 500);
    }
  },
});

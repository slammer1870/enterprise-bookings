import { APIError, CollectionSlug, Endpoint } from "payload";

import jwt from "jsonwebtoken";

import { PluginTypes } from "../types";

export const sendMagicLink = (pluginOptions: PluginTypes): Endpoint => ({
  path: "/send-magic-link",
  method: "post",
  handler: async (req): Promise<Response> => {
    // this is an example of an authenticated endpoint

    if (!req.json) {
      throw new APIError("Invalid request body", 400);
    }

    const { email, callbackUrl } = await req.json();

    const url: string | undefined = callbackUrl;

    if (!email) {
      throw new APIError("Invalid request body", 400);
    }

    const authCollectionSlug = (pluginOptions.authCollection ||
      "users") as CollectionSlug;

    const user = await req.payload.find({
      collection: authCollectionSlug,
      where: { email: { equals: email.toLowerCase() } },
    });

    if (!user || user.totalDocs === 0) {
      throw new APIError("User not found", 400);
    }

    const id = user.docs[0]?.id;

    if (!id) {
      throw new APIError("Error getting user", 400);
    }

    try {
      const fieldsToSign = {
        id: id,
        collection: authCollectionSlug,
      };

      const token = jwt.sign(fieldsToSign, req.payload.secret, {
        expiresIn: "15m", // Token expires in 15 minutes
      });

      // Create the magic link URL
      const magicLink = `${pluginOptions.serverURL}/api/users/verify-magic-link?token=${token}${
        url && `&callbackUrl=${url}`
      }`;

      await req.payload.sendEmail({
        to: email.toLowerCase(),
        from: process.env.DEFAULT_FROM_ADDRESS,
        subject: "Sign in Link",
        html: `<a href="${magicLink}">Click here to login</a>`,
      });

      return new Response(JSON.stringify("Magic Link Sent"), { status: 200 }); // Ensure to return a Response object
    } catch (error) {
      console.log("Magin clink error", error);
      throw new APIError("Error sending email", 500);
    }
  },
});

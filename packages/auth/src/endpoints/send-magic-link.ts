import { APIError, Endpoint } from "payload";

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

    if (!email) {
      throw new APIError("Invalid request body", 400);
    }

    const user = await req.payload.find({
      collection: "users",
      where: { email: { equals: email } },
    });

    if (!(user.docs.length > 0)) {
      throw new APIError("User not found", 400);
    }

    try {
      const fieldsToSign = {
        id: user.docs[0]?.id,
        email: user.docs[0]?.email,
        collection: "users",
      };

      const token = jwt.sign(fieldsToSign, req.payload.secret, {
        expiresIn: "15m", // Token expires in 15 minutes
      });

      // Create the magic link URL
      const magicLink = `${pluginOptions.serverURL}/api/users/verify-magic-link?token=${token}&callbackUrl=${callbackUrl || "/dashboard"}`;

      req.payload.sendEmail({
        to: email,
        from: "no-reply@example.com",
        subject: `Magic Link ${magicLink}`,
        html: `<a href="${magicLink}">Click here to login</a>`,
      });

      return new Response(JSON.stringify("Magic Link Sent"), { status: 200 }); // Ensure to return a Response object
    } catch (error) {
      console.log("Magin clink error", error);
      throw new APIError("Error sending email", 500);
    }
  },
});

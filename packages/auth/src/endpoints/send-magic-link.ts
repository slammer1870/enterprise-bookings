import { APIError, CollectionSlug, Endpoint } from "payload";

import jwt from "jsonwebtoken";

import { PluginTypes } from "../types";

import { render } from "@react-email/components";
import { MagicLinkEmail } from "../email/sign-in";
import { User } from "@repo/shared-types";

export const sendMagicLink = (pluginOptions: PluginTypes): Endpoint => ({
  path: "/send-magic-link",
  method: "post",
  handler: async (req): Promise<Response> => {
    // this is an example of an authenticated endpoint

    if (!req.json) {
      throw new APIError("Invalid request body", 400);
    }

    const { email, callbackUrl, utmParams } = await req.json();

    const url: string | undefined = callbackUrl;

    if (!email) {
      throw new APIError("Invalid request body", 400);
    }

    const authCollectionSlug = (pluginOptions.authCollection ||
      "users") as CollectionSlug;

    let user: User | null = null;

    const userQuery = await req.payload.find({
      collection: authCollectionSlug,
      where: { email: { equals: email.toLowerCase() } },
    });

    if (!userQuery || userQuery.totalDocs === 0) {
      throw new APIError("User not found", 400);
    }

    user = userQuery.docs[0] as User;

    const id = user.id;

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

      // Build UTM parameters string
      let utmString = "";
      if (utmParams && utmParams.trim()) {
        // Use provided UTM parameters
        utmString = `&${utmParams}`;
      } else {
        // Fallback to default UTM parameters
        utmString = "&utm_source=email&utm_medium=magic_link";
      }

      // Create the magic link URL
      const magicLink = `${pluginOptions.serverURL}/api/users/verify-magic-link?token=${token}${utmString}${
        url && `&callbackUrl=${url}`
      }`;

      const emailHtml = await render(
        MagicLinkEmail({
          magicLink,
          userName: user?.name as string | "",
          appName: pluginOptions.appName,
          expiryTime: "15 minutes",
        })
      );

      await req.payload.sendEmail({
        to: email.toLowerCase(),
        from: process.env.DEFAULT_FROM_ADDRESS,
        subject: `Sign in to ${pluginOptions.appName} - ${new Date().toLocaleString(
          "en-IE",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZone:
              req.payload.config.admin.timezones.defaultTimezone ||
              "Europe/Dublin",
          }
        )}`,
        html: emailHtml,
      });

      return new Response(JSON.stringify("Magic Link Sent"), { status: 200 }); // Ensure to return a Response object
    } catch (error) {
      console.log("Magin clink error", error);
      throw new APIError("Error sending email", 500);
    }
  },
});

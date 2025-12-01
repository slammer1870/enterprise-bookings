import { APIError, CollectionSlug, Endpoint } from "payload";

import jwt from "jsonwebtoken";

import { PluginTypes } from "../types";

import { render } from "@react-email/components";
import { MagicLinkEmail } from "../email/sign-in";
import { User, UTMParams } from "@repo/shared-types";

import { validateCallbackUrl } from "../utils/validate-callback-url";

export const sendMagicLink = (pluginOptions: PluginTypes): Endpoint => ({
  path: "/send-magic-link",
  method: "post",
  handler: async (req): Promise<Response> => {
    // this is an example of an authenticated endpoint

    if (!req.json) {
      throw new APIError("Invalid request body", 400);
    }

    const { email, callbackUrl, utmParams } = await req.json() as {
      email: string;
      callbackUrl?: string;
      utmParams?: UTMParams | string;
    };

    console.log("Raw utmParams:", utmParams, typeof utmParams);

    // Validate callback URL to prevent open redirect attacks
    const validatedCallbackUrl = validateCallbackUrl(
      callbackUrl,
      pluginOptions.serverURL,
    );

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
      if (utmParams) {
        if (typeof utmParams === 'string') {
          // If utmParams is a URL string, extract query parameters
          try {
            const url = new URL(utmParams);
            const searchParams = url.searchParams;
            const utmEntries: string[] = [];
            
            // Extract only UTM and Facebook parameters from the URL (exclude timestamp and other non-UTM params)
            const validUtmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'utm_adset_id', 'utm_campaign_id', 'fbclid'];
            validUtmParams.forEach(param => {
              const value = searchParams.get(param);
              if (value) {
                utmEntries.push(`${param}=${encodeURIComponent(value)}`);
              }
            });
            
            if (utmEntries.length > 0) {
              utmString = `&${utmEntries.join('&')}`;
            }
          } catch (error) {
            console.log("Error parsing UTM URL:", error);
            // Fallback to treating it as a query string
            utmString = utmParams.startsWith('&') ? utmParams : `&${utmParams}`;
          }
        } else if (typeof utmParams === 'object') {
          // Convert UTMParams object to query string, filtering out non-UTM parameters and null/undefined values
          const validUtmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'utm_adset_id', 'utm_campaign_id', 'fbclid'];
          const utmEntries = Object.entries(utmParams)
            .filter(([key, value]) => {
              // Only include valid UTM parameters that have non-null, non-undefined, non-empty values
              return validUtmParams.includes(key) && value !== null && value !== undefined && value !== '';
            })
            .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
            .join('&');
          if (utmEntries.length > 0) {
            utmString = `&${utmEntries}`;
          }
        }
        console.log("utmString", utmString);
      }
      
      // Fallback to default UTM parameters if no valid UTM params found
      if (!utmString) {
        utmString = "&utm_source=email&utm_medium=magic_link";
      }

      // Create the magic link URL
      // Only include callbackUrl if it's validated and safe
      const callbackUrlParam = validatedCallbackUrl
        ? `&callbackUrl=${encodeURIComponent(validatedCallbackUrl)}`
        : "";
      const magicLink = `${pluginOptions.serverURL}/api/users/verify-magic-link?token=${token}${utmString}${callbackUrlParam}`;

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
      console.log("Magic link error", error);
      throw new APIError("Error sending email", 500);
    }
  },
});

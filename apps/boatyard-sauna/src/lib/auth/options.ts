import type { BetterAuthOptions, BetterAuthPluginOptions } from "payload-auth/better-auth";
import { createBetterAuthOptions } from "@repo/better-auth/utils";

// Create better-auth options with app-specific enabled features
export const betterAuthOptions = createBetterAuthOptions({
  baseUrl: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  appName: "Boatyard Sauna",
  enabledFeatures: {
    emailAndPassword: true,
    magicLink: true, // Enable magic link
    google: true, // Enable Google sign-in
    requireEmailVerification: false,
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  trustedOrigins: [
    process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  ],
}) satisfies BetterAuthOptions;

// Plugin options for payload-auth
export const betterAuthPluginOptions: BetterAuthPluginOptions = {
  disabled: false,
  betterAuthOptions: betterAuthOptions,
  users: {
    slug: "users",
    hidden: false,
    adminRoles: ["admin"],
    defaultRole: "user",
    defaultAdminRole: "admin",
  },
};


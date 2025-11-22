import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import type { BetterAuthPlugin as BetterAuthPluginType } from "better-auth/types";
import { magicLink } from "better-auth/plugins";

export interface EnabledFeatures {
  emailAndPassword?: boolean;
  magicLink?: boolean;
  google?: boolean;
  requireEmailVerification?: boolean;
  plugins?: BetterAuthPlugin[];
}

export interface CreateBetterAuthOptionsParams {
  baseUrl: string;
  secret: string | undefined;
  appName: string;
  enabledFeatures?: EnabledFeatures;
  googleClientId?: string;
  googleClientSecret?: string;
  trustedOrigins?: string[];
  sendMagicLink?: (params: {
    email: string;
    token: string;
    url: string;
  }) => Promise<void> | void;
  sendResetPassword?: (params: { user: any; url: string }) => Promise<void> | void;
  sendVerificationEmail?: (data: {
    user: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null;
    };
    url: string;
    token: string;
  }, request?: Request) => Promise<void>;
}

export function createBetterAuthOptions(
  params: CreateBetterAuthOptionsParams
): BetterAuthOptions {
  const {
    baseUrl,
    secret,
    appName,
    enabledFeatures = {},
    googleClientId,
    googleClientSecret,
    trustedOrigins = [baseUrl],
    sendMagicLink,
    sendResetPassword,
    sendVerificationEmail,
  } = params;

  const {
    emailAndPassword = true,
    magicLink: enableMagicLink = false,
    google: enableGoogle = false,
    requireEmailVerification = false,
    plugins: extraPlugins = [],
  } = enabledFeatures;

  const plugins: BetterAuthPluginType[] = [];

  // Add magic link plugin if enabled
  if (enableMagicLink) {
    plugins.push(
      magicLink({
        sendMagicLink: sendMagicLink || (async ({ email, token, url }) => {
          console.log(`Send magic link for user: ${email}, token: ${token}, url: ${url}`);
        }),
      })
    );
  }

  // Add any extra plugins
  plugins.push(...extraPlugins);

  const socialProviders: BetterAuthOptions["socialProviders"] = {};

  // Add Google provider if enabled
  if (enableGoogle && googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  }

  // Build emailAndPassword config
  const emailAndPasswordConfig: BetterAuthOptions["emailAndPassword"] = emailAndPassword
    ? {
        enabled: true,
        requireEmailVerification: requireEmailVerification,
        ...(sendResetPassword && {
          async sendResetPassword({ user, url }) {
            await sendResetPassword({ user, url });
          },
        }),
      }
    : {
        enabled: false,
      };

  const config: BetterAuthOptions = {
    appName,
    baseURL: baseUrl,
    secret,
    trustedOrigins,
    emailAndPassword: emailAndPasswordConfig,
    ...(Object.keys(socialProviders).length > 0 && { socialProviders }),
    ...(plugins.length > 0 && { plugins }),
    ...(requireEmailVerification && {
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail:
          sendVerificationEmail ||
          (async (data) => {
            console.log(
              `Send verification email for user: ${data.user.id}, url: ${data.url}, token: ${data.token}`
            );
          }),
      },
    }),
  };

  return config satisfies BetterAuthOptions;
}


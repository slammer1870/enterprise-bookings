import {
  admin,
  magicLink as magicLinkPlugin,
  openAPI,
} from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import type { BetterAuthPlugin as BetterAuthPluginType } from "better-auth/types";
import { hashPassword, verifyPassword } from "@repo/auth-next/server";

import { buildMagicLinkEmailHtml } from "./emails/magic-link";
import { resolveBetterAuthEmailConfig } from "./emails/config";
import { sendEmail } from "./emails/send-email";
import { buildBasicAuthEmailHtml } from "./emails/templates";
import {
  isTestMagicLinkStoreEnabled,
  saveTestMagicLink,
} from "./test-magic-link-store";

export type BetterAuthRolesConfig = {
  adminRoles: string[];
  defaultRole: string;
  defaultAdminRole: string;
  roles: string[];
  allowedFields?: string[];
};

export type BetterAuthCollectionsConfig = {
  usersSlug?: string;
  accountsSlug?: string;
  sessionsSlug?: string;
  verificationsSlug?: string;
};

export type BetterAuthServerConfig = {
  appName: string;
  /**
   * Used by Better Auth for URL generation / validation.
   * Defaults to NEXT_PUBLIC_SERVER_URL or http://localhost:3000.
   */
  baseURL?: string;
  trustedOrigins?: string[];
  adminUserIds: string[];

  /**
   * Payload Auth plugin settings
   */
  disableDefaultPayloadAuth: boolean;
  hidePluginCollections: boolean;
  roles: BetterAuthRolesConfig;
  collections?: BetterAuthCollectionsConfig;

  /**
   * Better Auth settings
   */
  enableMagicLink: boolean;
  magicLinkDisableSignUp?: boolean;
  includeMagicLinkOptionConfig?: boolean;
  sessionCookieCache?: { enabled: boolean; maxAge?: number };

  /**
   * Shared Better Auth email configuration.
   *
   * - Magic-link emails are sent when magic-link is enabled (unless CI/test).
   * - Other auth emails are opt-in (enabled=false by default) to avoid changing behavior unexpectedly.
   */
  email?: {
    enabled?: boolean;
    fromAddress?: string;
    fromName?: string;
    /**
     * Enable non-magic-link auth emails (reset password, verification, change email, delete account).
     */
    enableOtherAuthEmails?: boolean;
  };
};

export function createBetterAuthPlugins({
  enableMagicLink,
  magicLinkDisableSignUp,
  adminUserIds,
  sendMagicLink,
}: {
  enableMagicLink: boolean;
  magicLinkDisableSignUp?: boolean;
  adminUserIds: string[];
  sendMagicLink: (args: {
    email: string;
    token: string;
    url: string;
  }) => Promise<void>;
}): BetterAuthPluginType[] {
  const plugins: BetterAuthPluginType[] = [];

  if (enableMagicLink) {
    plugins.push(
      magicLinkPlugin({
        sendMagicLink: async ({
          email,
          token,
          url,
        }: {
          email: string;
          token: string;
          url: string;
        }) => sendMagicLink({ email, token, url }),
        ...(typeof magicLinkDisableSignUp === "boolean"
          ? { disableSignUp: magicLinkDisableSignUp }
          : {}),
      })
    );
  }

  plugins.push(
    admin({
      adminUserIds,
    })
  );

  plugins.push(openAPI());
  plugins.push(nextCookies());

  return plugins;
}

export function createBetterAuthOptions(config: BetterAuthServerConfig) {
  const baseURL =
    config.baseURL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000";
  const emailCfg = resolveBetterAuthEmailConfig({
    enabled: Boolean(config.email?.enabled),
    fromAddress: config.email?.fromAddress,
    fromName: config.email?.fromName,
  });
  const enableOtherAuthEmails = Boolean(config.email?.enableOtherAuthEmails);

  const handleSendMagicLink = async ({
    email,
    token,
    url,
  }: {
    email: string;
    token: string;
    url: string;
  }) => {
    // test harness capture
    saveTestMagicLink({ email, token, url });

    if (isTestMagicLinkStoreEnabled() || process.env.CI) {
      console.log("Magic link captured (test/CI):", email, token, url);
      return;
    }

    const html = buildMagicLinkEmailHtml({
      magicLink: url,
      appName: config.appName,
      expiryTime: "15 minutes",
    });

    await sendEmail({
      to: email.toLowerCase(),
      subject: `Sign in to ${config.appName}`,
      html,
    });
  };

  const betterAuthPlugins = createBetterAuthPlugins({
    enableMagicLink: config.enableMagicLink,
    magicLinkDisableSignUp: config.magicLinkDisableSignUp,
    adminUserIds: config.adminUserIds,
    sendMagicLink: handleSendMagicLink,
  });

  const options: any = {
    appName: config.appName,
    baseURL,
    secret:
      process.env.BETTER_AUTH_SECRET ||
      process.env.PAYLOAD_SECRET ||
      "secret-fallback-for-development",
    trustedOrigins:
      config.trustedOrigins ||
      ([process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"].filter(
        Boolean
      ) as string[]),
    // Ensure auth cookies are available to the whole app, not just the auth route.
    // Without this, cookies can be scoped too narrowly (e.g. /api/auth) and `getSession()`
    // will appear to work only on auth endpoints.
    advanced: {
      defaultCookieAttributes: {
        path: "/",
      },
      cookies: {
        session_token: {
          attributes: {
            path: "/",
          },
        },
        session_data: {
          attributes: {
            path: "/",
          },
        },
        dont_remember: {
          attributes: {
            path: "/",
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
      async sendResetPassword({ user, url }: { user: any; url: string }) {
        const html = buildBasicAuthEmailHtml({
          appName: config.appName,
          title: `Reset your password`,
          greeting: user?.name ? `Hello, ${user.name}` : "Hello",
          body: `We received a request to reset your ${config.appName} password.\nThis link may expire soon.`,
          ctaText: "Reset password",
          ctaUrl: url,
          footer: `If you did not request this, you can ignore this email.`,
        });
        await sendEmail({
          to: String(user?.email || "").toLowerCase(),
          subject: `Reset your ${config.appName} password`,
          html,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ _user, url }: { _user: any; url: string }) {
        const html = buildBasicAuthEmailHtml({
          appName: config.appName,
          title: `Verify your email`,
          greeting: "Hello",
          body: `Please verify your email address to finish setting up your ${config.appName} account.`,
          ctaText: "Verify email",
          ctaUrl: url,
        });
        // Best-effort: Better Auth passes `_user` in some contexts; keep safe.
        const to = String((_user as any)?.email || "").toLowerCase();
        if (!to) return;
        await sendEmail({
          to,
          subject: `Verify your email for ${config.appName}`,
          html,
        });
      },
    },
    plugins: betterAuthPlugins,
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailVerification: async ({
          _user,
          newEmail,
          url,
          token,
        }: {
          _user: any;
          newEmail: string;
          url: string;
          token: string;
        }) => {
          const html = buildBasicAuthEmailHtml({
            appName: config.appName,
            title: `Confirm your new email`,
            greeting: "Hello",
            body: `We received a request to change the email on your ${config.appName} account.\nConfirm the new email address by clicking below.`,
            ctaText: "Confirm email change",
            ctaUrl: url,
          });
          await sendEmail({
            to: newEmail.toLowerCase(),
            subject: `Confirm your new email for ${config.appName}`,
            html,
          });
        },
      },
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({
          _user,
          url,
          token,
        }: {
          _user: any;
          url: string;
          token: string;
        }) => {
          const to = String((_user as any)?.email || "").toLowerCase();
          if (!to) return;
          const html = buildBasicAuthEmailHtml({
            appName: config.appName,
            title: `Confirm account deletion`,
            greeting: (_user as any)?.name
              ? `Hello, ${(_user as any).name}`
              : "Hello",
            body: `We received a request to delete your ${config.appName} account.\nIf this was you, confirm below.`,
            ctaText: "Confirm deletion",
            ctaUrl: url,
            footer: `If you did not request this, contact support immediately.`,
          });
          await sendEmail({
            to,
            subject: `Confirm deletion of your ${config.appName} account`,
            html,
          });
        },
        beforeDelete: async (_user: any) => {},
        afterDelete: async (_user: any) => {},
      },
    },
    session: {
      cookieCache:
        config.sessionCookieCache ??
        ({
          enabled: false,
          maxAge: 5 * 60,
        } as any),
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "email-password"],
      },
    },
  };

  // Some apps previously configured this top-level property; keep opt-in to avoid changing behavior.
  if (config.enableMagicLink && config.includeMagicLinkOptionConfig) {
    options.magicLink = {
      enabled: true,
      disableSignUp: Boolean(config.magicLinkDisableSignUp),
      sendMagicLink: async ({
        email,
        token,
        url,
      }: {
        email: string;
        token: string;
        url: string;
      }) => handleSendMagicLink({ email, token, url }),
    };
  }

  return options;
}

export function createBetterAuthPluginOptions(config: BetterAuthServerConfig) {
  const usersSlug = config.collections?.usersSlug || "users";
  const accountsSlug = config.collections?.accountsSlug || "accounts";
  const sessionsSlug = config.collections?.sessionsSlug || "sessions";
  const verificationsSlug =
    config.collections?.verificationsSlug || "verifications";

  const betterAuthOptions = createBetterAuthOptions(config);

  return {
    disabled: false,
    debug: {
      logTables: false,
      enableDebugLogs: false,
    },
    admin: {
      loginMethods: ["emailPassword"],
    },
    disableDefaultPayloadAuth: config.disableDefaultPayloadAuth,
    hidePluginCollections: config.hidePluginCollections,
    users: {
      slug: usersSlug,
      hidden: false,
      adminRoles: config.roles.adminRoles,
      defaultRole: config.roles.defaultRole,
      defaultAdminRole: config.roles.defaultAdminRole,
      roles: config.roles.roles,
      allowedFields: config.roles.allowedFields ?? ["name"],
    },
    accounts: { slug: accountsSlug },
    sessions: { slug: sessionsSlug },
    verifications: { slug: verificationsSlug },
    adminInvitations: {
      sendInviteEmail: async ({
        _payload,
        email,
        url,
      }: {
        _payload: any;
        email: string;
        url: string;
      }) => {
        console.log("Send admin invite: ", email, url);
        return { success: true };
      },
    },
    betterAuthOptions,
  };
}

export { buildMagicLinkEmailHtml } from "./emails/magic-link";
export { resolveBetterAuthEmailConfig } from "./emails/config";
export { sendEmail } from "./emails/send-email";
export { buildBasicAuthEmailHtml } from "./emails/templates";
export {
  clearTestMagicLinks,
  getLatestTestMagicLink,
  isTestMagicLinkStoreEnabled,
  saveTestMagicLink,
} from "./test-magic-link-store";

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
import * as emailSender from "./emails/send-email";
import { buildBasicAuthEmailHtml } from "./emails/templates";
import { formatFrom } from "./emails/config";
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

export type BetterAuthTrustedOriginsProvider = (
  _request: Request
) => string[] | Promise<string[]>;

export type BetterAuthServerConfig = {
  appName: string;
  /**
   * Used by Better Auth for URL generation / validation.
   * Defaults to NEXT_PUBLIC_SERVER_URL or http://localhost:3000.
   */
  baseURL?: string;
  trustedOrigins?: string[] | BetterAuthTrustedOriginsProvider;
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
  /**
   * Cookie domain strategy.
   * - "derived" (default): derive a cookie domain from `baseURL` (e.g. ".atnd-me.com") for subdomain sharing.
   * - "host": omit the Domain attribute (host-only cookies), required for tenant custom domains.
   */
  cookieDomainStrategy?: "derived" | "host";
  /**
   * Optional per-magic-link email app name resolver.
   * Useful for multi-tenant apps where the magic-link URL hostname maps to a tenant brand name.
   *
   * If it returns a non-empty string, that value is used for the magic-link email subject and template
   * (e.g. "Sign in to {tenant name}"). Otherwise it falls back to `appName`.
   */
  resolveMagicLinkAppName?: (_args: {
    email: string;
    token: string;
    url: string;
  }) => Promise<string | null> | string | null;
  /**
   * Optional per-magic-link email "From" resolver.
   * If it returns a non-empty `fromAddress`, it will be used for the magic-link email's From header.
   * `fromName` defaults to the resolved magic-link app name when omitted.
   */
  resolveMagicLinkFrom?: (_args: {
    email: string;
    token: string;
    url: string;
  }) =>
    | Promise<{ fromName?: string | null; fromAddress?: string | null } | null>
    | { fromName?: string | null; fromAddress?: string | null }
    | null;
  /**
   * Optional per-reset-password email app name resolver (tenant branding).
   * If it returns a non-empty string, it will be used in the reset password email template.
   */
  resolveResetPasswordAppName?: (_args: { user: any; url: string }) => Promise<string | null> | string | null;
  /**
   * Optional per-reset-password email "From" resolver (tenant branding).
   * If it returns a non-empty `fromAddress`, it will be used for the reset password email's From header.
   * `fromName` defaults to the resolved reset-password app name when omitted.
   */
  resolveResetPasswordFrom?: (_args: { user: any; url: string }) =>
    | Promise<{ fromName?: string | null; fromAddress?: string | null } | null>
    | { fromName?: string | null; fromAddress?: string | null }
    | null;
  sessionCookieCache?: { enabled: boolean; maxAge?: number };
  /** Session expires after this many seconds (Better Auth default ~7 days). */
  sessionExpiresInSeconds?: number;
  /** Refresh session every N seconds of activity; extends expiration. */
  sessionUpdateAgeSeconds?: number;

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

  /**
   * Optional social providers (e.g. Google). When set, OAuth sign-in is enabled.
   */
  socialProviders?: {
    google?: {
      clientId: string;
      clientSecret: string;
    };
  };
};

function deriveCookieDomainFromBaseURL(baseURL: string): string | undefined {
  try {
    const { hostname } = new URL(baseURL)

    // Host-only cookies are fine for localhost / IPs, and many browsers reject
    // `Domain=localhost` anyway.
    if (!hostname) return undefined
    if (hostname.includes("localhost")) return undefined
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return undefined
    if (!hostname.includes(".")) return undefined

    return `.${hostname}`
  } catch {
    return undefined
  }
}

export function createBetterAuthPlugins({
  enableMagicLink,
  magicLinkDisableSignUp,
  adminUserIds,
  sendMagicLink,
}: {
  enableMagicLink: boolean;
  magicLinkDisableSignUp?: boolean;
  adminUserIds: string[];
  sendMagicLink: (_args: {
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

function scopeUrlToCallbackOrigin(inputUrl: string): string {
  try {
    const url = new URL(inputUrl)
    const callback = url.searchParams.get("callbackURL")
    if (!callback) return inputUrl

    // callbackURL is usually URL-encoded; URLSearchParams returns it decoded.
    // Only scope when it's an absolute http(s) URL.
    const cbUrl = new URL(callback)
    if (cbUrl.protocol !== "http:" && cbUrl.protocol !== "https:") return inputUrl

    url.protocol = cbUrl.protocol
    url.host = cbUrl.host
    return url.toString()
  } catch {
    return inputUrl
  }
}

function formatEmailSubjectTimestamp(date = new Date()): string {
  // Keep this stable (UTC) so subjects don't vary by server locale/timezone.
  // Example: "Tue, 12th of March 2026 14:03:22 UTC"
  const timeZone = "UTC"

  const day = Number(
    new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone }).format(date)
  )
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone,
  }).format(date)
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone,
  }).format(date)
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone,
  }).format(date)

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).format(date)

  return `${weekday}, ${day}${ordinalSuffix(day)} of ${month} ${year} ${time} ${timeZone}`
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return "th"
  switch (n % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

export function createBetterAuthOptions(config: BetterAuthServerConfig) {
  const baseURL =
    config.baseURL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000";
  const cookieDomain =
    config.cookieDomainStrategy === "host"
      ? undefined
      : deriveCookieDomainFromBaseURL(baseURL)
  const _emailCfg = resolveBetterAuthEmailConfig({
    enabled: Boolean(config.email?.enabled),
    fromAddress: config.email?.fromAddress,
    fromName: config.email?.fromName,
  });
  const _enableOtherAuthEmails = Boolean(config.email?.enableOtherAuthEmails);

  const handleSendMagicLink = async ({
    email,
    token,
    url,
  }: {
    email: string;
    token: string;
    url: string;
  }) => {
    const scopedUrl = scopeUrlToCallbackOrigin(url)

    // test harness capture
    saveTestMagicLink({ email, token, url: scopedUrl });

    if (isTestMagicLinkStoreEnabled() || process.env.CI) {
      console.log("Magic link captured (test/CI):", email, token, scopedUrl);
      return;
    }

    let magicLinkAppName = config.appName;
    if (typeof config.resolveMagicLinkAppName === "function") {
      try {
        const resolved = await config.resolveMagicLinkAppName({ email, token, url: scopedUrl });
        if (typeof resolved === "string" && resolved.trim()) {
          magicLinkAppName = resolved.trim();
        }
      } catch (err) {
        console.warn("[better-auth-config] resolveMagicLinkAppName failed; using default appName.", err);
      }
    }

    // Optional per-tenant From header override
    let from: string | undefined = undefined;
    if (typeof config.resolveMagicLinkFrom === "function") {
      try {
        const resolved = await config.resolveMagicLinkFrom({ email, token, url: scopedUrl });
        const fromNameRaw = resolved && typeof resolved === "object" ? resolved.fromName : null;
        const fromAddressRaw = resolved && typeof resolved === "object" ? resolved.fromAddress : null;
        const fromAddress =
          typeof fromAddressRaw === "string" && fromAddressRaw.trim()
            ? fromAddressRaw.trim()
            : "";
        if (fromAddress) {
          const fromName =
            typeof fromNameRaw === "string" && fromNameRaw.trim()
              ? fromNameRaw.trim()
              : magicLinkAppName;
          from = formatFrom(fromName, fromAddress);
        }
      } catch (err) {
        console.warn("[better-auth-config] resolveMagicLinkFrom failed; using default From.", err);
      }
    }

    const html = buildMagicLinkEmailHtml({
      magicLink: scopedUrl,
      appName: magicLinkAppName,
      expiryTime: "15 minutes",
    });

    await emailSender.sendEmail({
      to: email.toLowerCase(),
      subject: `Sign in to ${magicLinkAppName} - ${formatEmailSubjectTimestamp()}`,
      html,
      ...(from ? { from } : {}),
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
    ...(config.socialProviders && Object.keys(config.socialProviders).length > 0
      ? { socialProviders: config.socialProviders }
      : {}),
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
    //
    // IMPORTANT: For multi-tenant apps with subdomain routing, we need cookies to work
    // across subdomains. In development (localhost), omitting domain allows cookies to
    // work across subdomains. In production, you should set domain to '.yourdomain.com'.
    advanced: {
      defaultCookieAttributes: {
        path: "/",
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
      cookies: {
        session_token: {
          attributes: {
            path: "/",
            ...(cookieDomain ? { domain: cookieDomain } : {}),
          },
        },
        session_data: {
          attributes: {
            path: "/",
            ...(cookieDomain ? { domain: cookieDomain } : {}),
          },
        },
        dont_remember: {
          attributes: {
            path: "/",
            ...(cookieDomain ? { domain: cookieDomain } : {}),
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
        const scopedUrl = scopeUrlToCallbackOrigin(url)

        let resetAppName = config.appName
        if (typeof config.resolveResetPasswordAppName === "function") {
          try {
            const resolved = await config.resolveResetPasswordAppName({ user, url: scopedUrl })
            if (typeof resolved === "string" && resolved.trim()) {
              resetAppName = resolved.trim()
            }
          } catch (err) {
            console.warn("[better-auth-config] resolveResetPasswordAppName failed; using default appName.", err);
          }
        }

        let from: string | undefined = undefined;
        if (typeof config.resolveResetPasswordFrom === "function") {
          try {
            const resolved = await config.resolveResetPasswordFrom({ user, url: scopedUrl });
            const fromNameRaw = resolved && typeof resolved === "object" ? resolved.fromName : null;
            const fromAddressRaw = resolved && typeof resolved === "object" ? resolved.fromAddress : null;
            const fromAddress =
              typeof fromAddressRaw === "string" && fromAddressRaw.trim()
                ? fromAddressRaw.trim()
                : "";
            if (fromAddress) {
              const fromName =
                typeof fromNameRaw === "string" && fromNameRaw.trim()
                  ? fromNameRaw.trim()
                  : resetAppName;
              from = formatFrom(fromName, fromAddress);
            }
          } catch (err) {
            console.warn("[better-auth-config] resolveResetPasswordFrom failed; using default From.", err);
          }
        }

        const html = buildBasicAuthEmailHtml({
          appName: resetAppName,
          title: `Reset your password`,
          greeting: user?.name ? `Hello, ${user.name}` : "Hello",
          body: `We received a request to reset your ${resetAppName} password.\nThis link may expire soon.`,
          ctaText: "Reset password",
          ctaUrl: scopedUrl,
          footer: `If you did not request this, you can ignore this email.`,
        });
        await emailSender.sendEmail({
          to: String(user?.email || "").toLowerCase(),
          subject: `Reset your ${resetAppName} password`,
          html,
          ...(from ? { from } : {}),
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
        await emailSender.sendEmail({
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
          token: _token,
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
          await emailSender.sendEmail({
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
          token: _token,
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
          await emailSender.sendEmail({
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
      ...(config.sessionExpiresInSeconds != null
        ? { expiresIn: config.sessionExpiresInSeconds }
        : {}),
      ...(config.sessionUpdateAgeSeconds != null
        ? { updateAge: config.sessionUpdateAgeSeconds }
        : {}),
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

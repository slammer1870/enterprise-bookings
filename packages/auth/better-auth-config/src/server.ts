import {
  admin,
  magicLink as magicLinkPlugin,
  openAPI,
} from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import type { BetterAuthOptions } from "better-auth";
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
   * Magic link token lifetime in seconds. Defaults to Better Auth's built-in default (300 s / 5 min).
   * Note: this is a global setting — Better Auth does not support per-token expiry overrides.
   * Set a longer value (e.g. 72 * 60 * 60 for 72 hours) when links are used for async flows
   * like booking completion where the user may not act immediately.
   */
  magicLinkExpiresIn?: number;
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
   * Optional per-magic-link email content resolver.
   * Allows customising the email body instructions, CTA button text, and subject line based
   * on the magic-link URL (e.g. to show "Complete your booking" copy when the callbackURL
   * points to a booking management page rather than a generic sign-in).
   *
   * Returning `null` (or omitting fields) falls back to the default sign-in copy.
   */
  resolveMagicLinkEmailContent?: (_args: {
    email: string;
    token: string;
    url: string;
  }) =>
    | Promise<{
        instructions?: string | null;
        ctaText?: string | null;
        subject?: string | null;
      } | null>
    | {
        instructions?: string | null;
        ctaText?: string | null;
        subject?: string | null;
      }
    | null;
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
   * Optional Better Auth database hooks (run in the auth request context, before adapter writes).
   * Use for fields that are not set by the Payload adapter because it calls `payload.create` without `req`.
   */
  databaseHooks?: NonNullable<BetterAuthOptions["databaseHooks"]>;

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
  magicLinkExpiresIn,
  adminUserIds,
  sendMagicLink,
}: {
  enableMagicLink: boolean;
  magicLinkDisableSignUp?: boolean;
  magicLinkExpiresIn?: number;
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
        ...(typeof magicLinkExpiresIn === "number"
          ? { expiresIn: magicLinkExpiresIn }
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

function secondsToHumanDisplay(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`
  const hours = Math.round(seconds / 3600)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`
  const days = Math.round(seconds / 86400)
  return `${days} day${days === 1 ? "" : "s"}`
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

/**
 * Core email-sending logic shared between the Better Auth `sendMagicLink` callback
 * and the custom-expiry booking magic link sender.
 *
 * `expiryDisplayOverride` lets callers supply a pre-computed human-readable expiry
 * string (e.g. "36 hours") instead of deriving it from `config.magicLinkExpiresIn`.
 */
async function executeMagicLinkEmailSend(
  config: BetterAuthServerConfig,
  {
    email,
    token,
    url,
    expiryDisplayOverride,
  }: {
    email: string;
    token: string;
    url: string;
    expiryDisplayOverride?: string;
  }
): Promise<void> {
  let magicLinkAppName = config.appName;
  if (typeof config.resolveMagicLinkAppName === "function") {
    try {
      const resolved = await config.resolveMagicLinkAppName({ email, token, url });
      if (typeof resolved === "string" && resolved.trim()) {
        magicLinkAppName = resolved.trim();
      }
    } catch (err) {
      console.warn("[better-auth-config] resolveMagicLinkAppName failed; using default appName.", err);
    }
  }

  let from: string | undefined = undefined;
  if (typeof config.resolveMagicLinkFrom === "function") {
    try {
      const resolved = await config.resolveMagicLinkFrom({ email, token, url });
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

  let emailInstructions: string | undefined = undefined;
  let emailCtaText: string | undefined = undefined;
  let emailSubject: string | undefined = undefined;
  if (typeof config.resolveMagicLinkEmailContent === "function") {
    try {
      const resolved = await config.resolveMagicLinkEmailContent({ email, token, url });
      if (resolved && typeof resolved === "object") {
        if (typeof resolved.instructions === "string" && resolved.instructions.trim()) {
          emailInstructions = resolved.instructions.trim();
        }
        if (typeof resolved.ctaText === "string" && resolved.ctaText.trim()) {
          emailCtaText = resolved.ctaText.trim();
        }
        if (typeof resolved.subject === "string" && resolved.subject.trim()) {
          emailSubject = resolved.subject.trim();
        }
      }
    } catch (err) {
      console.warn("[better-auth-config] resolveMagicLinkEmailContent failed; using default copy.", err);
    }
  }

  const expiryDisplay = expiryDisplayOverride ?? secondsToHumanDisplay(config.magicLinkExpiresIn ?? 300);

  const html = buildMagicLinkEmailHtml({
    magicLink: url,
    appName: magicLinkAppName,
    expiryTime: expiryDisplay,
    ...(emailInstructions ? { instructions: emailInstructions } : {}),
    ...(emailCtaText ? { ctaText: emailCtaText } : {}),
  });

  const defaultSubject = emailCtaText
    ? `${emailCtaText} – ${formatEmailSubjectTimestamp()}`
    : `Sign in to ${magicLinkAppName} - ${formatEmailSubjectTimestamp()}`;

  await emailSender.sendEmail({
    to: email.toLowerCase(),
    subject: emailSubject ?? defaultSubject,
    html,
    ...(from ? { from } : {}),
  });
}

/**
 * Returns a sender function that creates a magic link token directly in the Payload
 * `verifications` collection with a custom expiry, then sends the email via the
 * same tenant-aware resolvers used for regular sign-in magic links.
 *
 * This exists because Better Auth's `signInMagicLink` only supports a single global
 * `expiresIn` value, so flows that need a different expiry (e.g. booking completion)
 * must create the verification record themselves.
 *
 * Usage:
 * ```ts
 * const sender = createCustomExpiryMagicLinkSender(config)
 * await sender({ payload, email, callbackURL, expiresInSeconds: 36 * 60 * 60 })
 * ```
 */
export function createCustomExpiryMagicLinkSender(config: BetterAuthServerConfig) {
  return async function sendMagicLinkWithCustomExpiry({
    payload,
    email,
    callbackURL,
    expiresInSeconds,
  }: {
    /** Payload instance (available as `req.payload` in endpoints). */
    payload: { create: (..._args: any[]) => Promise<any> };
    email: string;
    /** The absolute URL the user should land on after clicking the link. */
    callbackURL: string;
    /** Token lifetime in seconds. */
    expiresInSeconds: number;
  }): Promise<void> {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(24).toString("base64url"); // 32-char URL-safe token

    const verificationsSlug = config.collections?.verificationsSlug ?? "verifications";
    await payload.create({
      collection: verificationsSlug,
      data: {
        identifier: token,
        value: JSON.stringify({ email }),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      },
      overrideAccess: true,
    });

    // Build the verify URL on the same origin as the callbackURL so the
    // tenant-scoped session cookie is set on the right domain.
    let verifyUrl: string;
    try {
      const origin = new URL(callbackURL).origin;
      const u = new URL("/api/auth/magic-link/verify", origin);
      u.searchParams.set("token", token);
      u.searchParams.set("callbackURL", callbackURL);
      verifyUrl = u.toString();
    } catch {
      throw new Error(`Invalid callbackURL for magic link: ${callbackURL}`);
    }

    const scopedUrl = scopeUrlToCallbackOrigin(verifyUrl);

    // Test / CI: capture rather than send.
    saveTestMagicLink({ email, token, url: scopedUrl });
    if (isTestMagicLinkStoreEnabled() || process.env.CI) {
      console.log("Magic link captured (test/CI):", email, token, scopedUrl);
      return;
    }

    await executeMagicLinkEmailSend(config, {
      email,
      token,
      url: scopedUrl,
      expiryDisplayOverride: secondsToHumanDisplay(expiresInSeconds),
    });
  };
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
    const scopedUrl = scopeUrlToCallbackOrigin(url);

    // test harness capture
    saveTestMagicLink({ email, token, url: scopedUrl });

    if (isTestMagicLinkStoreEnabled() || process.env.CI) {
      console.log("Magic link captured (test/CI):", email, token, scopedUrl);
      return;
    }

    await executeMagicLinkEmailSend(config, { email, token, url: scopedUrl });
  };

  const betterAuthPlugins = createBetterAuthPlugins({
    enableMagicLink: config.enableMagicLink,
    magicLinkDisableSignUp: config.magicLinkDisableSignUp,
    magicLinkExpiresIn: config.magicLinkExpiresIn,
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
    ...(config.databaseHooks ? { databaseHooks: config.databaseHooks } : {}),
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

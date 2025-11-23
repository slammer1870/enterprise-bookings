import { admin, magicLink, openAPI } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import type { BetterAuthPlugin as BetterAuthPluginType } from 'better-auth/types'

export const betterAuthPlugins = [
  magicLink({
    sendMagicLink: async ({ email, token, url }, _request) => {
      console.log('Send magic link for user: ', email, token, url)
    },
  }),
  admin({
    adminUserIds: ['1'],
  }),
  openAPI(),
  nextCookies(),
] satisfies BetterAuthPluginType[]

export type BetterAuthPlugins = typeof betterAuthPlugins

export const betterAuthOptions = {
  appName: 'Mindful Yard',
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret:
    process.env.BETTER_AUTH_SECRET ||
    process.env.PAYLOAD_SECRET ||
    'secret-fallback-for-development',
  trustedOrigins: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'].filter(
    Boolean,
  ) as string[],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }: { user: any; url: string }) {
      console.log('Send reset password for user: ', user.id, 'at url', url)
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ _user, url }: { _user: any; url: string }) {
      console.log('Send verification email for user: ', url)
    },
  },
  plugins: betterAuthPlugins,
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ _user, newEmail, url, token }: { _user: any; newEmail: string; url: string; token: string }) => {
        console.log('Send change email verification for user: ', newEmail, url, token)
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ _user, url, token }: { _user: any; url: string; token: string }) => {
        console.log('Send delete account verification: ', url, token)
      },
      beforeDelete: async (_user: any) => {
        // Perform actions before user deletion
      },
      afterDelete: async (_user: any) => {
        // Perform cleanup after user deletion
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'email-password'],
    },
  },
}

export type ConstructedBetterAuthOptions = typeof betterAuthOptions

export const betterAuthPluginOptions = {
  disabled: false,
  debug: {
    logTables: false,
    enableDebugLogs: false,
  },
  admin: {
    loginMethods: ['emailPassword'],
  },
  disableDefaultPayloadAuth: true,
  hidePluginCollections: false,
  users: {
    slug: 'users',
    hidden: false,
    adminRoles: ['admin'],
    defaultRole: 'customer',
    defaultAdminRole: 'admin',
    roles: ['customer', 'admin'],
    allowedFields: ['name'],
  },
  accounts: {
    slug: 'accounts',
  },
  sessions: {
    slug: 'sessions',
  },
  verifications: {
    slug: 'verifications',
  },
  adminInvitations: {
    sendInviteEmail: async ({ _payload, email, url }: { _payload: any; email: string; url: string }) => {
      console.log('Send admin invite: ', email, url)
      return {
        success: true,
      }
    },
  },
  betterAuthOptions: betterAuthOptions,
}

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions







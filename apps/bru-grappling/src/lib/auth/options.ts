import type { BetterAuthOptions, BetterAuthPluginOptions } from 'payload-auth/better-auth'
import { admin, magicLink, openAPI } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import type { BetterAuthPlugin as BetterAuthPluginType } from 'better-auth/types'

export const betterAuthPlugins = [
  magicLink({
    sendMagicLink: async ({ email, token, url }, request) => {
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
  appName: 'payload-better-auth',
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
    // autoSignIn: true,
    async sendResetPassword({ user, url }) {
      console.log('Send reset password for user: ', user.id, 'at url', url)
    },
  },
  /*socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },*/
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      console.log('Send verification email for user: ', url)
    },
  },
  plugins: betterAuthPlugins,
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
        console.log('Send change email verification for user: ', user, newEmail, url, token)
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        // Send delete account verification
      },
      beforeDelete: async (user) => {
        // Perform actions before user deletion
      },
      afterDelete: async (user) => {
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
} satisfies BetterAuthOptions

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
    slug: 'users', // not required, this is the default anyways
    hidden: false,
    adminRoles: ['admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin'] as const,
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
    sendInviteEmail: async ({ payload, email, url }) => {
      console.log('Send admin invite: ', email, url)
      return {
        success: true,
      }
    },
  },
  betterAuthOptions: betterAuthOptions,
} satisfies BetterAuthPluginOptions

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

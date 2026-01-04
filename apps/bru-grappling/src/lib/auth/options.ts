import { admin, magicLink, openAPI } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import type { BetterAuthPlugin as BetterAuthPluginType } from 'better-auth/types'
import { hashPassword, verifyPassword } from '@repo/auth-next/server'

import { saveTestMagicLink } from './test-magic-link-store'

const handleSendMagicLink = async ({
  email,
  token,
  url,
}: {
  email: string
  token: string
  url: string
}) => {
  // Capture link for test harness; no-op outside test mode
  saveTestMagicLink({ email, token, url })
  console.log('Send magic link for user: ', email, token, url)
}

export const betterAuthPlugins = [
  magicLink({
    sendMagicLink: async ({ email, token, url }) => handleSendMagicLink({ email, token, url }),
    disableSignUp: true,
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
    // Custom password handling to support legacy Payload CMS passwords (PBKDF2)
    // alongside Better Auth's default scrypt hashing.
    // See: https://www.better-auth.com/docs/authentication/email-password#configuration
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    // autoSignIn: true,
    async sendResetPassword({ user, url }: { user: any; url: string }) {
      console.log('Send reset password for user: ', user.id, 'at url', url)
    },
  },
  magicLink: {
    enabled: true,
    disableSignUp: true,
    sendMagicLink: async ({ email, token, url }: { email: string; token: string; url: string }) =>
      handleSendMagicLink({ email, token, url }),
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
    async sendVerificationEmail({ user, url }: { user: any; url: string }) {
      console.log('Send verification email for user: ', url)
    },
  },
  plugins: betterAuthPlugins,
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({
        user,
        newEmail,
        url,
        token,
      }: {
        user: any
        newEmail: string
        url: string
        token: string
      }) => {
        console.log('Send change email verification for user: ', user, newEmail, url, token)
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({
        user,
        url,
        token,
      }: {
        user: any
        url: string
        token: string
      }) => {
        // Send delete account verification
      },
      beforeDelete: async (user: any) => {
        // Perform actions before user deletion
      },
      afterDelete: async (user: any) => {
        // Perform cleanup after user deletion
      },
    },
  },
  session: {
    cookieCache: {
      enabled: false, // Disabled to avoid cookie size limits
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
  disableDefaultPayloadAuth: false,
  hidePluginCollections: true,
  users: {
    slug: 'users', // not required, this is the default anyways
    hidden: false,
    adminRoles: ['admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin'],
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
    sendInviteEmail: async ({
      payload,
      email,
      url,
    }: {
      payload: any
      email: string
      url: string
    }) => {
      console.log('Send admin invite: ', email, url)
      return {
        success: true,
      }
    },
  },
  betterAuthOptions: betterAuthOptions,
}

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

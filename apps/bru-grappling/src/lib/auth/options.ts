import type { BetterAuthOptions, BetterAuthPluginOptions } from 'payload-auth/better-auth'
import { createBetterAuthOptions } from '@repo/better-auth/utils'

// Create better-auth options with app-specific enabled features
export const betterAuthOptions = createBetterAuthOptions({
  baseUrl: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  appName: 'Brú Grappling',
  enabledFeatures: {
    emailAndPassword: true,
    magicLink: true, // Enable magic link authentication
    google: false, // Disable Google sign-in
    requireEmailVerification: false,
  },
  sendMagicLink: async ({ email, token, url }) => {
    // TODO: Implement actual email sending via Resend
    console.log(`Send magic link for user: ${email}`)
    console.log(`Magic link URL: ${url}`)
    console.log(`Token: ${token}`)
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
}) satisfies BetterAuthOptions

// Plugin options for payload-auth
export const betterAuthPluginOptions: BetterAuthPluginOptions = {
  disabled: false,
  betterAuthOptions: betterAuthOptions,
  users: {
    slug: 'users',
    hidden: false,
    adminRoles: ['admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
  },
}

'use client'

import { createAppAuthClient, getCallbackUrl } from '@repo/better-auth-config/client'

export const authClient = createAppAuthClient({
  enableMagicLink: true,
  enableAdmin: true,
})

export const { signIn, signUp, signOut, useSession } = authClient

// Helper function to get callback URL from current URL
export { getCallbackUrl }








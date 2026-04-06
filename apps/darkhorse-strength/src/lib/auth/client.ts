'use client'

import { createAppAuthClient, getCallbackUrl } from '@repo/better-auth-config/client'

export const authClient: ReturnType<typeof createAppAuthClient> = createAppAuthClient({
  enableMagicLink: true,
  enableAdmin: true,
})

export const signIn: typeof authClient.signIn = authClient.signIn
export const signUp: typeof authClient.signUp = authClient.signUp
export const signOut: typeof authClient.signOut = authClient.signOut
export const useSession: typeof authClient.useSession = authClient.useSession

// Helper function to get callback URL from current URL
export { getCallbackUrl }








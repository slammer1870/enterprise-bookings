'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

export const authClient: ReturnType<typeof createAppAuthClient> = createAppAuthClient({
  enableAdmin: true,
  enableMagicLink: false,
})

export const signIn: typeof authClient.signIn = authClient.signIn
export const signUp: typeof authClient.signUp = authClient.signUp
export const signOut: typeof authClient.signOut = authClient.signOut
export const useSession: typeof authClient.useSession = authClient.useSession








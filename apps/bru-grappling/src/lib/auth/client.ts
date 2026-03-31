'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

export const authClient: ReturnType<typeof createAppAuthClient> = createAppAuthClient({
  enableMagicLink: true,
  enableAdmin: true,
})

type AuthClient = ReturnType<typeof createAppAuthClient>

export const signIn: AuthClient['signIn'] = authClient.signIn
export const signUp: AuthClient['signUp'] = authClient.signUp
export const signOut: AuthClient['signOut'] = authClient.signOut
export const useSession: AuthClient['useSession'] = authClient.useSession

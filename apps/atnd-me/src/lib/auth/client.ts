'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

export const authClient: ReturnType<typeof createAppAuthClient> = createAppAuthClient({
  // Use same-origin on tenant subdomains to avoid CORS issues.
  // (Env defaults often point at the root domain, which breaks `*.localhost` in dev.)
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  enableMagicLink: true,
  enableAdmin: true,
})

export const signIn: typeof authClient.signIn = authClient.signIn
export const signUp: typeof authClient.signUp = authClient.signUp
export const signOut: typeof authClient.signOut = authClient.signOut
export const useSession: typeof authClient.useSession = authClient.useSession

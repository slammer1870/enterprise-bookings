'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

export const authClient = createAppAuthClient({
  // Use same-origin on tenant subdomains to avoid CORS issues.
  // (Env defaults often point at the root domain, which breaks `*.localhost` in dev.)
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  enableMagicLink: true,
  enableAdmin: true,
})

export const { signIn, signUp, signOut, useSession } = authClient

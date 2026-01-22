'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

export const authClient = createAppAuthClient({
  enableMagicLink: true,
  enableAdmin: true,
})

export const { signIn, signUp, signOut, useSession } = authClient

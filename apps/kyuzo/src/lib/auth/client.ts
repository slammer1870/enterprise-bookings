'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

export const authClient = createAppAuthClient({
  enableAdmin: true,
  enableMagicLink: false,
})

export const { signIn, signUp, signOut, useSession } = authClient








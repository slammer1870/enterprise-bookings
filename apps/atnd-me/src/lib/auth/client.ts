'use client'

import { createAppAuthClient } from '@repo/better-auth-config/client'

// TypeScript inference issue with better-auth types in Next.js build
// Using explicit any type to work around this limitation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _authClient: any = createAppAuthClient({
  enableMagicLink: true,
  enableAdmin: true,
})

export const authClient = _authClient
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn: any = _authClient.signIn
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signUp: any = _authClient.signUp
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signOut: any = _authClient.signOut
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useSession: any = _authClient.useSession
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const magicLink: any = _authClient.magicLink

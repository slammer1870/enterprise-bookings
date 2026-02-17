'use client'

import { createContext, useCallback, useContext, ReactNode } from 'react'
import type { Session, Account, DeviceSession } from '@/lib/auth/types'
import type { TypedUser } from 'payload'
import { authClient } from '@/lib/auth/client'

export type SignInWithGoogle = (callbackURL: string) => Promise<void>

type UserContextType = {
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
  /** Only set when Google OAuth is configured (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) */
  signInWithGoogle: SignInWithGoogle | null
}

const BetterAuthContext = createContext<UserContextType | null>(null)

export function useBetterAuth(): UserContextType {
  const context = useContext(BetterAuthContext)
  if (context === null) {
    throw new Error('useBetterAuth must be used within a BetterAuthProvider')
  }
  return context
}

export function BetterAuthProvider({
  children,
  sessionPromise,
  userAccountsPromise,
  deviceSessionsPromise,
  currentUserPromise,
  googleSignInEnabled,
}: {
  children: ReactNode
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
  googleSignInEnabled: boolean
}) {
  const signInWithGoogleCallback = useCallback(async (callbackURL: string) => {
    const url =
      typeof window !== 'undefined' && !/^https?:\/\//i.test(callbackURL)
        ? new URL(callbackURL, window.location.origin).href
        : callbackURL
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: url,
    })
  }, [])

  const signInWithGoogle = googleSignInEnabled ? signInWithGoogleCallback : null

  return (
    <BetterAuthContext.Provider
      value={{
        sessionPromise,
        userAccountsPromise,
        deviceSessionsPromise,
        currentUserPromise,
        signInWithGoogle,
      }}
    >
      {children}
    </BetterAuthContext.Provider>
  )
}

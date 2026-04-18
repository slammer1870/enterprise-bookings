import type { Account, DeviceSession, Session } from '@/lib/auth/types'
import { getPayload } from '@/lib/payload'
import { sanitizeBetterAuthSession } from '@repo/shared-utils'
import type { TypedUser } from 'payload'
import { headers as requestHeaders } from 'next/headers'

export const getSession = async (): Promise<Session | null> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const raw = await payload.betterAuth.api.getSession({ headers })
    return sanitizeBetterAuthSession(raw)
  } catch (error) {
    // Avoid error boundary on auth/session failures (e.g. cookie missing on subdomain, CI timing).
    // Callers should treat null as unauthenticated and redirect to sign-in.
    console.error('[getSession]', error)
    return null
  }
}

export const getUserAccounts = async (): Promise<Account[]> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const accounts = await payload.betterAuth.api.listUserAccounts({ headers })

    // Ensure we return an array - handle cases where API returns error or non-array response
    if (Array.isArray(accounts)) {
      return accounts
    }

    // If not an array, return empty array (user might not be authenticated)
    return []
  } catch (error) {
    // If API call fails (e.g., user not authenticated), return empty array
    console.error('Error fetching user accounts:', error)
    return []
  }
}

export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const sessions = await payload.betterAuth.api.listSessions({ headers })

    // Ensure we return an array - handle cases where API returns error or non-array response
    if (Array.isArray(sessions)) {
      return sessions
    }

    // If not an array, return empty array (user might not be authenticated)
    return []
  } catch (error) {
    // If API call fails (e.g., user not authenticated), return empty array
    console.error('Error fetching device sessions:', error)
    return []
  }
}

export const currentUser = async (): Promise<TypedUser | null> => {
  const payload = await getPayload()
  const headers = await requestHeaders()
  const { user } = await payload.auth({ headers })
  return user
}

/** Same condition as options.ts: Google OAuth only when both env vars are set */
export const googleSignInEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
)

export const getContextProps = (): {
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
  googleSignInEnabled: boolean
} => {
  const sessionPromise = getSession()

  // Only fetch accounts and sessions if user is authenticated
  // This prevents unnecessary API calls and errors when user is not logged in
  const userAccountsPromise = sessionPromise.then(async (session) => {
    if (!session?.user) return []
    return getUserAccounts()
  })

  const deviceSessionsPromise = sessionPromise.then(async (session) => {
    if (!session?.user) return []
    return getDeviceSessions()
  })

  const currentUserPromise = currentUser()
  return {
    sessionPromise,
    userAccountsPromise,
    deviceSessionsPromise,
    currentUserPromise,
    googleSignInEnabled,
  }
}

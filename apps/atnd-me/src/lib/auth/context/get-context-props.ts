import type { Account, DeviceSession, Session } from '@/lib/auth/types'
import { getPayload } from '@/lib/payload'
import { sanitizeBetterAuthSession } from '@repo/shared-utils'
import type { TypedUser } from 'payload'
import { cookies, headers as requestHeaders } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'

/** Skip Better Auth / Payload auth lookups when the browser has no session cookie. */
async function hasAuthSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  for (const { name } of cookieStore.getAll()) {
    // Better Auth uses `better-auth.*` locally and `__Secure-better-auth.*` (or
    // `__Host-…`) on HTTPS/production. A startsWith('better-auth.') check alone
    // short-circuits getSession() to null while the client/tRPC session still works,
    // which sends already-logged-in users to the booking login redirect.
    if (
      name.includes('better-auth.') ||
      name === 'session_token' ||
      name === 'session_data' ||
      name === 'dont_remember' ||
      name.endsWith('.session_token') ||
      name.endsWith('.session_data') ||
      name.endsWith('.dont_remember')
    ) {
      return true
    }
  }
  return false
}

export const getSession = async (): Promise<Session | null> => {
  // Keep cookies()/headers() outside try/catch so Next can opt the route into
  // dynamic rendering. Swallowing DYNAMIC_SERVER_USAGE logs noisy errors and
  // breaks static→dynamic bailout during prerender/ISR.
  if (!(await hasAuthSessionCookie())) return null
  const headers = await requestHeaders()

  try {
    const payload = await getPayload()
    const raw = await payload.betterAuth.api.getSession({ headers })
    return sanitizeBetterAuthSession(raw)
  } catch (error) {
    unstable_rethrow(error)
    // Avoid error boundary on auth/session failures (e.g. cookie missing on subdomain, CI timing).
    // Callers should treat null as unauthenticated and redirect to sign-in.
    console.error('[getSession]', error)
    return null
  }
}

export const getUserAccounts = async (): Promise<Account[]> => {
  const headers = await requestHeaders()

  try {
    const payload = await getPayload()
    const accounts = await payload.betterAuth.api.listUserAccounts({ headers })

    // Ensure we return an array - handle cases where API returns error or non-array response
    if (Array.isArray(accounts)) {
      return accounts
    }

    // If not an array, return empty array (user might not be authenticated)
    return []
  } catch (error) {
    unstable_rethrow(error)
    // If API call fails (e.g., user not authenticated), return empty array
    console.error('Error fetching user accounts:', error)
    return []
  }
}

export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  const headers = await requestHeaders()

  try {
    const payload = await getPayload()
    const sessions = await payload.betterAuth.api.listSessions({ headers })

    // Ensure we return an array - handle cases where API returns error or non-array response
    if (Array.isArray(sessions)) {
      return sessions
    }

    // If not an array, return empty array (user might not be authenticated)
    return []
  } catch (error) {
    unstable_rethrow(error)
    // If API call fails (e.g., user not authenticated), return empty array
    console.error('Error fetching device sessions:', error)
    return []
  }
}

export const currentUser = async (): Promise<TypedUser | null> => {
  if (!(await hasAuthSessionCookie())) return null
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

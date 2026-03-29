import type { Account, DeviceSession, Session } from '@/lib/auth/types'
import { getPayload } from '@/lib/payload'
import type { TypedUser } from 'payload'
import { headers as requestHeaders } from 'next/headers'

export const getSession = async (): Promise<Session | null> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const session = await payload.betterAuth.api.getSession({ headers })
    return session as Session | null
  } catch (error) {
    // If getSession fails (e.g. missing/invalid session cookie), treat as unauthenticated
    console.error("[getSession] better-auth session fetch failed:", error)
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

  // Prefer Better Auth session when enabled; Payload auth may throw "No User" when unauthenticated.
  try {
    const betterAuth: any = (payload as any).betterAuth
    if (betterAuth?.api?.getSession) {
      const session = await betterAuth.api.getSession({ headers })
      if (session?.user) return session.user as TypedUser
    }
  } catch {
    // ignore and fall back
  }

  try {
    const { user } = await payload.auth({ headers })
    return user
  } catch {
    return null
  }
}

export const getContextProps = (): {
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
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
  return { sessionPromise, userAccountsPromise, deviceSessionsPromise, currentUserPromise }
}








import type { Account, DeviceSession, Session } from '@/lib/auth/types'
import { getPayload } from '@/lib/payload'
import type { TypedUser } from 'payload'
import { headers as requestHeaders } from 'next/headers'

export const getSession = async (): Promise<Session | null> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const session = await payload.betterAuth.api.getSession({ headers })
    return session
  } catch (error: any) {
    // UNAUTHORIZED (401) is expected when there's no authenticated session
    // This is normal for unauthenticated users and health checks
    // Other errors (500, network issues, etc.) should still be thrown
    if (error?.status === 'UNAUTHORIZED' || error?.statusCode === 401) {
      return null
    }
    // Log unexpected errors in production for debugging
    if (process.env.NODE_ENV === 'production') {
      console.error('Unexpected error in getSession:', error)
    }
    throw error
  }
}

export const getUserAccounts = async (): Promise<Account[]> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const accounts = await payload.betterAuth.api.listUserAccounts({ headers })
    return accounts
  } catch (error: any) {
    // UNAUTHORIZED (401) is expected when there's no authenticated session
    if (error?.status === 'UNAUTHORIZED' || error?.statusCode === 401) {
      return []
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('Unexpected error in getUserAccounts:', error)
    }
    throw error
  }
}

export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const sessions = await payload.betterAuth.api.listSessions({ headers })
    return sessions
  } catch (error: any) {
    // UNAUTHORIZED (401) is expected when there's no authenticated session
    if (error?.status === 'UNAUTHORIZED' || error?.statusCode === 401) {
      return []
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('Unexpected error in getDeviceSessions:', error)
    }
    throw error
  }
}

export const currentUser = async (): Promise<TypedUser | null> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const { user } = await payload.auth({ headers })
    return user
  } catch (error: any) {
    // UNAUTHORIZED (401) is expected when there's no authenticated session
    if (error?.status === 'UNAUTHORIZED' || error?.statusCode === 401) {
      return null
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('Unexpected error in currentUser:', error)
    }
    throw error
  }
}

export const getContextProps = (): {
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
} => {
  const sessionPromise = getSession()
  const userAccountsPromise = getUserAccounts()
  const deviceSessionsPromise = getDeviceSessions()
  const currentUserPromise = currentUser()
  return { sessionPromise, userAccountsPromise, deviceSessionsPromise, currentUserPromise }
}

import type { Account, DeviceSession, Session } from '@/lib/auth/types'
import { getPayload } from '@/lib/payload'
import type { TypedUser } from 'payload'
import { headers as requestHeaders } from 'next/headers'

export const getSession = async (): Promise<Session | null> => {
  const payload = await getPayload()
  const headers = await requestHeaders()
  const session = await payload.betterAuth.api.getSession({ headers })
  return session as Session | null
}

export const getUserAccounts = async (): Promise<Account[]> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const accounts = await payload.betterAuth.api.listUserAccounts({ headers })

    if (Array.isArray(accounts)) return accounts as Account[]
    return []
  } catch (error) {
    console.error('Error fetching user accounts:', error)
    return []
  }
}

export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  try {
    const payload = await getPayload()
    const headers = await requestHeaders()
    const sessions = await payload.betterAuth.api.listSessions({ headers })

    if (Array.isArray(sessions)) return sessions as DeviceSession[]
    return []
  } catch (error) {
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

export const getContextProps = (): {
  sessionPromise: Promise<Session | null>
  userAccountsPromise: Promise<Account[]>
  deviceSessionsPromise: Promise<DeviceSession[]>
  currentUserPromise: Promise<TypedUser | null>
} => {
  const sessionPromise = getSession()

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



